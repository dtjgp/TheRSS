#import "ui.h"

static NSArray<NSWindow *> *TRAlertWindows(TRHost *host) {
  if (!host.fixture) return @[];
  NSMutableArray *result = [NSMutableArray array];
  for (NSWindow *window in NSApp.windows) {
    if (window == host.sheet || !window.visible || !window.sheetParent) continue;
    NSWindow *parent = window.sheetParent;
    while (parent && parent != host.window) parent = parent.sheetParent;
    if (parent == host.window) [result addObject:window];
  }
  return result;
}
static NSArray<NSView *> *TRAlertViews(NSWindow *window) {
  NSMutableArray *views = [NSMutableArray arrayWithObject:window.contentView];
  for (NSUInteger i = 0; i < views.count; i++) [views addObjectsFromArray:((NSView *)views[i]).subviews];
  return views;
}
NSArray<NSDictionary *> *TRFixtureAlerts(TRHost *host) {
  NSMutableArray *result = [NSMutableArray array];
  for (NSWindow *window in TRAlertWindows(host)) {
    NSMutableArray *buttons = [NSMutableArray array], *labels = [NSMutableArray array];
    for (NSView *view in TRAlertViews(window)) {
      if ([view isKindOfClass:NSButton.class]) [buttons addObject:((NSButton *)view).title];
      if ([view isKindOfClass:NSTextField.class] && ![view isKindOfClass:NSSecureTextField.class]) [labels addObject:((NSTextField *)view).stringValue];
    }
    [result addObject:@{@"buttons":buttons,@"text":labels,@"windowNumber":@(window.windowNumber)}];
  }
  return result;
}
BOOL TRActivateFixtureAlert(TRHost *host, NSString *title) {
  for (NSWindow *window in TRAlertWindows(host)) for (NSView *view in TRAlertViews(window)) {
    if ([view isKindOfClass:NSButton.class] && [((NSButton *)view).title isEqual:title] && ((NSButton *)view).enabled) { [(NSButton *)view performClick:nil]; return YES; }
  }
  return NO;
}

static NSString *TRFocusOwner(TRNode *node, NSResponder *responder) {
  if (node.control == responder) return node.identifier;
  if ([node.control isKindOfClass:NSScrollView.class] && ((NSScrollView *)node.control).documentView == responder) return node.identifier;
  if ([node.control isKindOfClass:NSTextField.class] && ((NSTextField *)node.control).currentEditor == responder) return node.identifier;
  for (TRNode *child in node.nodes) { NSString *identifier = TRFocusOwner(child,responder); if (identifier) return identifier; }
  return nil;
}

@interface TRSheet : NSPanel
@property(nonatomic, weak) TRHost *host;
@end
@implementation TRSheet
- (void)cancelOperation:(id)sender { [self.host emit:self.host.modal.spec[@"context"] value:nil secret:NO]; }
@end

@implementation TRHost
- (void)mount {
  self.zoom = 1;
  self.secureFields = [NSMutableDictionary dictionary];
  self.original = self.window.contentView;
  self.canvas = [[TRCanvas alloc] initWithFrame:self.original.frame]; self.canvas.paintsBackground = YES;
  self.canvas.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
  [self.original removeFromSuperview]; self.original.hidden = YES; [self.canvas addSubview:self.original];
  self.window.contentView = self.canvas;
  __weak TRHost *weakSelf = self;
  self.closeObserver = [NSNotificationCenter.defaultCenter addObserverForName:NSWindowWillCloseNotification object:self.window queue:nil usingBlock:^(NSNotification *notification) { [weakSelf dispose]; }];
  self.focusObserver = [NSNotificationCenter.defaultCenter addObserverForName:NSWindowDidBecomeKeyNotification object:self.window queue:nil usingBlock:^(NSNotification *notification) { [weakSelf ensureNativeFocus]; }];
  self.accessibilityObserver = [NSWorkspace.sharedWorkspace.notificationCenter addObserverForName:NSWorkspaceAccessibilityDisplayOptionsDidChangeNotification object:nil queue:nil usingBlock:^(NSNotification *notification) { [weakSelf updateMaterials]; }];
}
- (BOOL)increaseContrast { return self.fixtureContrast ? self.fixtureContrast.boolValue : NSWorkspace.sharedWorkspace.accessibilityDisplayShouldIncreaseContrast; }
- (BOOL)reduceTransparency { return [self increaseContrast] || (self.fixtureTransparency ? !self.fixtureTransparency.boolValue : NSWorkspace.sharedWorkspace.accessibilityDisplayShouldReduceTransparency); }
- (void)updateMaterials {
  NSMutableArray<TRNode *> *queue = [NSMutableArray array]; if (self.root) [queue addObject:self.root]; if (self.modal) [queue addObject:self.modal];
  for (NSUInteger i = 0; i < queue.count; i++) { [queue[i] updateMaterial]; [queue[i] update:queue[i].spec]; [queue addObjectsFromArray:queue[i].nodes]; }
  [self.root layoutSubtreeIfNeeded]; [self.modal layoutSubtreeIfNeeded];
}
- (void)present:(NSDictionary *)scene {
  if (self.disposed) return;
  self.zoom = [scene[@"zoom"] doubleValue];
  for (NSString *identifier in scene[@"clearSecure"]) {
    NSSecureTextField *field = (NSSecureTextField *)self.secureFields[identifier].control;
    field.stringValue = @"";
    if (field.currentEditor) { ((NSTextView *)field.currentEditor).string = @""; [field.currentEditor.undoManager removeAllActions]; }
  }
  NSDictionary *spec = scene[@"root"];
  if (!self.root || ![self.root.identifier isEqual:spec[@"id"]] || ![self.root.spec[@"kind"] isEqual:spec[@"kind"]]) {
    [self.root removeFromSuperview]; self.root = [[TRNode alloc] initWithHost:self spec:spec];
    self.root.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable; [self.canvas addSubview:self.root];
  } else [self.root update:spec];
  self.root.frame = self.canvas.bounds;
  [self.root layoutSubtreeIfNeeded];
  NSDictionary *modal = scene[@"modal"];
  if (modal) {
    if (self.sheet && ![self.modal.identifier isEqual:modal[@"id"]]) { [self.window endSheet:self.sheet]; [self.sheet orderOut:nil]; self.sheet = nil; self.modal = nil; }
    if (!self.sheet) {
      self.previousResponder = self.window.firstResponder;
      TRSheet *sheet = [[TRSheet alloc] initWithContentRect:NSMakeRect(0,0,MIN(820,self.window.frame.size.width-80),MIN(680,self.window.frame.size.height-100)) styleMask:NSWindowStyleMaskTitled|NSWindowStyleMaskClosable backing:NSBackingStoreBuffered defer:NO];
      sheet.host = self; sheet.delegate = self; sheet.releasedWhenClosed = NO; sheet.title = modal[@"title"] ?: @"TheRSS";
      self.sheet = sheet; self.modal = [[TRNode alloc] initWithHost:self spec:modal];
      self.modal.paintsBackground = YES; self.modal.autoresizingMask = NSViewWidthSizable|NSViewHeightSizable;
      sheet.contentView = self.modal; [self.window beginSheet:sheet completionHandler:nil];
    } else [self.modal update:modal];
    self.modal.frame = self.sheet.contentView.bounds; [self.modal layoutSubtreeIfNeeded];
  } else if (self.sheet) {
    [self.window endSheet:self.sheet]; [self.sheet orderOut:nil]; self.sheet = nil; self.modal = nil;
    if ([self.previousResponder isKindOfClass:NSView.class] && [(NSView *)self.previousResponder isDescendantOf:self.root]) [self.window makeFirstResponder:self.previousResponder];
    self.previousResponder = nil;
    [self ensureNativeFocus];
  }
  NSString *focus = scene[@"focus"];
  if (focus) {
    TRNode *node = [self find:focus]; NSView *control = node.control ?: node;
    if ([control isKindOfClass:NSScrollView.class]) control = ((NSScrollView *)control).documentView;
    if (control.window) [control.window makeFirstResponder:control];
  }
}
- (void)ensureNativeFocus {
  if (self.disposed || self.sheet || !self.root) return;
  NSResponder *responder = self.window.firstResponder;
  if ([responder isKindOfClass:NSView.class] && [(NSView *)responder isDescendantOf:self.root]) return;
  TRNode *input = [self.root find:@"discover-query"] ?: [self.root find:@"personal-prompt"] ?: [self.root find:@"provider-name"] ?: [self.root find:@"sources-query"] ?: [self.root find:@"saved-items"] ?: [self.root find:@"analytics-analyses"];
  NSView *target = input.control ?: self.root.control;
  if ([target isKindOfClass:NSScrollView.class]) target = ((NSScrollView *)target).documentView;
  [self.window makeFirstResponder:target];
}
- (BOOL)windowShouldClose:(NSWindow *)sender {
  if (sender == self.sheet) { [self emit:self.modal.spec[@"context"] value:nil secret:NO]; return NO; }
  return YES;
}
- (void)emit:(NSString *)action value:(id)value secret:(BOOL)secret {
  if (self.disposed || !action.length) return;
  NSMutableDictionary *event = [@{@"action":action} mutableCopy]; if (value) event[@"value"] = value;
  NSData *data = [NSJSONSerialization dataWithJSONObject:event options:0 error:nil]; if (!data) return;
  while (!pending.empty() && pending.front()->delivered) pending.pop_front();
  auto record = std::make_shared<TREvent>(); record->json.assign((const char *)data.bytes,data.length); record->secret = secret; record->host = self;
  pending.push_back(record);
  auto queued = new std::shared_ptr<TREvent>(record);
  napi_status status = napi_call_threadsafe_function(self.regularCallback,queued,napi_tsfn_nonblocking);
  if (status != napi_ok) { record->delivered = true; delete queued; }
}
- (void)flush {
  if (self.disposed) return;
  auto copy = pending;
  for (const auto& event : copy) {
    if (event->delivered) continue;
    napi_value callback; napi_get_reference_value(self.env,event->secret ? self.secretRef : self.regularRef,&callback);
    TRDeliver(self.env,callback,event);
  }
  while (!pending.empty() && pending.front()->delivered) pending.pop_front();
}
- (void)dispose {
  if (self.disposed) return;
  self.disposed = YES;
  for (const auto& event : pending) { event->delivered = true; event->json.clear(); } pending.clear();
  if (self.closeObserver) [NSNotificationCenter.defaultCenter removeObserver:self.closeObserver]; self.closeObserver = nil;
  if (self.focusObserver) [NSNotificationCenter.defaultCenter removeObserver:self.focusObserver]; self.focusObserver = nil;
  if (self.accessibilityObserver) [NSWorkspace.sharedWorkspace.notificationCenter removeObserver:self.accessibilityObserver]; self.accessibilityObserver = nil;
  if (self.sheet) { [self.window endSheet:self.sheet]; [self.sheet orderOut:nil]; self.sheet = nil; self.modal = nil; }
  if (self.window.contentView == self.canvas) { [self.original removeFromSuperview]; self.original.hidden = NO; self.window.contentView = self.original; }
  self.root = nil;
  for (TRNode *node in self.secureFields.allValues) ((NSSecureTextField *)node.control).stringValue = @"";
  [self.secureFields removeAllObjects];
  if (self.regularCallback) { napi_release_threadsafe_function(self.regularCallback,napi_tsfn_abort); self.regularCallback = nullptr; }
  if (self.regularRef) { napi_delete_reference(self.env,self.regularRef); self.regularRef = nullptr; }
  if (self.secretRef) { napi_delete_reference(self.env,self.secretRef); self.secretRef = nullptr; }
}
- (TRNode *)find:(NSString *)identifier { return [self.modal find:identifier] ?: [self.root find:identifier]; }
- (NSDictionary *)inspect {
  NSMutableDictionary *secure = [NSMutableDictionary dictionary];
  for (NSString *identifier in self.secureFields) secure[identifier] = @{@"hasValue":@(((NSSecureTextField *)self.secureFields[identifier].control).stringValue.length > 0)};
  NSMutableArray *ownedWindows = [NSMutableArray array];
  NSArray *windows = CFBridgingRelease(CGWindowListCopyWindowInfo(kCGWindowListOptionAll,kCGNullWindowID));
  for (NSDictionary *window in windows) if ([window[(id)kCGWindowOwnerPID] intValue] == NSProcessInfo.processInfo.processIdentifier) [ownedWindows addObject:window];
  return @{@"alerts":TRFixtureAlerts(self),@"firstResponderId":TRFocusOwner(self.modal ?: self.root,(self.sheet ?: self.window).firstResponder) ?: @"",@"windowAppearance":self.window.appearance.name ?: @"automatic",@"windowEffectiveAppearance":self.window.effectiveAppearance.name,@"nativeRoot":NSStringFromClass(self.window.contentView.class),@"webHidden":@(self.original.hidden),@"windowNumber":@(self.window.windowNumber),@"visible":@(self.window.visible),@"onActiveSpace":@(self.window.onActiveSpace),@"miniaturized":@(self.window.miniaturized),@"zoom":@(self.zoom),@"root":[self.root inspect] ?: @{},@"modal":self.modal ? [self.modal inspect] : NSNull.null,@"firstResponder":NSStringFromClass((self.sheet ?: self.window).firstResponder.class),@"disposed":@(self.disposed),@"secureDrafts":secure,@"ownedWindowServerEntries":ownedWindows};
}
@end
