#import "ui.h"
#import <objc/runtime.h>
#include <cstring>

static char hostKey;
static napi_value fail(napi_env env, const char *message) { napi_throw_error(env,nullptr,message); return nullptr; }
static napi_value nothing(napi_env env) { napi_value value; napi_get_undefined(env,&value); return value; }
static NSWindow *windowFor(napi_env env, napi_value value) {
  bool isBuffer = false; void *data = nullptr; size_t size = 0;
  napi_is_buffer(env,value,&isBuffer);
  if (!isBuffer || napi_get_buffer_info(env,value,&data,&size) != napi_ok || size != sizeof(void *) || !NSThread.isMainThread) { fail(env,"Invalid native window handle or thread"); return nil; }
  void *pointer = nullptr; std::memcpy(&pointer,data,size);
  for (NSWindow *window in NSApp.windows) {
    TRHost *host = objc_getAssociatedObject(window,&hostKey);
    if (pointer == (__bridge void *)window.contentView || (host && pointer == (__bridge void *)host.original)) return window;
  }
  fail(env,"Native window is unavailable"); return nil;
}
static TRHost *hostFor(napi_env env, napi_value value) {
  NSWindow *window = windowFor(env,value); if (!window) return nil;
  TRHost *host = objc_getAssociatedObject(window,&hostKey);
  if (!host || host.disposed) { fail(env,"Native interface is detached"); return nil; }
  return host;
}
static NSDictionary *jsonFor(napi_env env, napi_value value, size_t maximum) {
  size_t size = 0;
  if (napi_get_value_string_utf8(env,value,nullptr,0,&size) != napi_ok || size > maximum) { fail(env,"Invalid native payload size"); return nil; }
  std::string json(size+1,'\0'); napi_get_value_string_utf8(env,value,json.data(),json.size(),&size);
  NSData *data = [NSData dataWithBytes:json.data() length:size];
  id object = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  if (![object isKindOfClass:NSDictionary.class]) { fail(env,"Invalid native payload"); return nil; }
  return object;
}
static napi_value jsonValue(napi_env env, NSDictionary *object) {
  NSData *data = [NSJSONSerialization dataWithJSONObject:object options:0 error:nil];
  if (!data) return fail(env,"Native inspection failed");
  napi_value value; napi_create_string_utf8(env,(const char *)data.bytes,data.length,&value); return value;
}
void TRDeliver(napi_env env, napi_value callback, const std::shared_ptr<TREvent>& event) {
  if (event->delivered) return; event->delivered = true;
  if (env && callback) {
    napi_value value, receiver, result;
    napi_create_string_utf8(env,event->json.c_str(),event->json.size(),&value); napi_get_undefined(env,&receiver);
    napi_call_function(env,receiver,callback,1,&value,&result);
  }
  event->json.clear();
}
static void deliver(napi_env env, napi_value callback, void *, void *data) {
  auto event = static_cast<std::shared_ptr<TREvent> *>(data);
  TRHost *host = (*event)->host;
  if (env && host && !host.disposed) [host flush];
  else TRDeliver(nullptr,nullptr,*event);
  delete event;
}
static napi_value attach(napi_env env, napi_callback_info info) {
  napi_value args[3]; size_t count = 3; napi_get_cb_info(env,info,&count,args,nullptr,nullptr);
  if (count != 3) return fail(env,"Native attach requires a window and two callbacks");
  NSWindow *window = windowFor(env,args[0]); if (!window) return nullptr;
  TRHost *previous = objc_getAssociatedObject(window,&hostKey); if (previous && !previous.disposed) return fail(env,"Native interface already attached");
  napi_valuetype first, second; napi_typeof(env,args[1],&first); napi_typeof(env,args[2],&second);
  if (first != napi_function || second != napi_function) return fail(env,"Native callbacks must be functions");
  TRHost *host = [TRHost new]; host.env = env; host.window = window;
  host.fixture = std::getenv("THERSS_E2E_FIXTURES") && std::strcmp(std::getenv("THERSS_E2E_FIXTURES"),"1") == 0;
  napi_value resource; napi_create_string_utf8(env,"TheRSSAppKit",NAPI_AUTO_LENGTH,&resource);
  napi_threadsafe_function regular;
  if (napi_create_threadsafe_function(env,args[1],nullptr,resource,0,1,nullptr,nullptr,nullptr,deliver,&regular) != napi_ok) return fail(env,"Native event callback unavailable");
  host.regularCallback = regular;
  napi_ref regularRef, secretRef; napi_create_reference(env,args[1],1,&regularRef); napi_create_reference(env,args[2],1,&secretRef);
  host.regularRef = regularRef; host.secretRef = secretRef;
  [host mount]; objc_setAssociatedObject(window,&hostKey,host,OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  return nothing(env);
}
static napi_value present(napi_env env, napi_callback_info info) {
  napi_value args[2]; size_t count = 2; napi_get_cb_info(env,info,&count,args,nullptr,nullptr); if (count != 2) return fail(env,"Invalid presentation");
  TRHost *host = hostFor(env,args[0]); if (!host) return nullptr;
  NSDictionary *scene = jsonFor(env,args[1],12000000); if (!scene) return nullptr;
  if ([scene[@"version"] intValue] != 1 || ![scene[@"root"] isKindOfClass:NSDictionary.class] || [scene[@"zoom"] doubleValue] < 0.8 || [scene[@"zoom"] doubleValue] > 1.5) return fail(env,"Unsupported native scene");
  [host present:scene]; return nothing(env);
}
static napi_value inspect(napi_env env, napi_callback_info info) {
  napi_value arg; size_t count = 1; napi_get_cb_info(env,info,&count,&arg,nullptr,nullptr); if (count != 1) return fail(env,"Invalid inspection");
  TRHost *host = hostFor(env,arg); return host ? jsonValue(env,[host inspect]) : nullptr;
}
static napi_value flush(napi_env env, napi_callback_info info) {
  napi_value arg; size_t count = 1; napi_get_cb_info(env,info,&count,&arg,nullptr,nullptr); if (count != 1) return fail(env,"Invalid flush");
  TRHost *host = hostFor(env,arg); if (!host) return nullptr; [host flush]; return nothing(env);
}
static napi_value detach(napi_env env, napi_callback_info info) {
  napi_value arg; size_t count = 1; napi_get_cb_info(env,info,&count,&arg,nullptr,nullptr); if (count != 1) return fail(env,"Invalid detach");
  NSWindow *window = windowFor(env,arg); if (!window) return nullptr;
  TRHost *host = objc_getAssociatedObject(window,&hostKey); [host dispose]; objc_setAssociatedObject(window,&hostKey,nil,OBJC_ASSOCIATION_RETAIN_NONATOMIC); return nothing(env);
}
static napi_value edit(napi_env env, napi_callback_info info) {
  napi_value args[2]; size_t count = 2; napi_get_cb_info(env,info,&count,args,nullptr,nullptr); if (count != 2) return fail(env,"Invalid edit action");
  TRHost *host = hostFor(env,args[0]); if (!host) return nullptr;
  char command[32]; size_t size = 0;
  if (napi_get_value_string_utf8(env,args[1],command,sizeof(command),&size) != napi_ok || size >= sizeof(command)-1) return fail(env,"Invalid edit command");
  SEL selector = nullptr;
  if (!std::strcmp(command,"copy")) selector = @selector(copy:);
  else if (!std::strcmp(command,"cut")) selector = @selector(cut:);
  else if (!std::strcmp(command,"paste")) selector = @selector(paste:);
  else if (!std::strcmp(command,"selectAll")) selector = @selector(selectAll:);
  else if (!std::strcmp(command,"undo")) selector = NSSelectorFromString(@"undo:");
  else if (!std::strcmp(command,"redo")) selector = NSSelectorFromString(@"redo:");
  else return fail(env,"Unsupported native edit command");
  NSResponder *responder = (host.sheet ?: host.window).firstResponder;
  BOOL handled = NO;
  if ([responder isKindOfClass:NSTextView.class] && (!std::strcmp(command,"undo") || !std::strcmp(command,"redo"))) {
    NSUndoManager *manager = responder.undoManager;
    if (!std::strcmp(command,"undo") && manager.canUndo) [manager undo];
    if (!std::strcmp(command,"redo") && manager.canRedo) [manager redo];
    handled = YES;
  } else handled = [responder tryToPerform:selector with:nil];
  napi_value result; napi_get_boolean(env,handled,&result); return result;
}
static napi_value interactFixture(napi_env env, napi_callback_info info) {
  napi_value args[2]; size_t count = 2; napi_get_cb_info(env,info,&count,args,nullptr,nullptr); if (count != 2) return fail(env,"Invalid fixture action");
  TRHost *host = hostFor(env,args[0]); if (!host) return nullptr; if (!host.fixture) return fail(env,"Native fixture actions require an explicit fixture process");
  NSDictionary *input = jsonFor(env,args[1],100000); if (!input) return nullptr;
  if ([input[@"action"] isEqual:@"quit"]) {
    // Post to this fixture application's event loop, matching Command-Q dispatch.
    [host.window makeKeyAndOrderFront:nil]; [NSApp activateIgnoringOtherApps:YES];
    NSEvent *event = [NSEvent keyEventWithType:NSEventTypeKeyDown location:NSZeroPoint modifierFlags:NSEventModifierFlagCommand timestamp:0 windowNumber:host.window.windowNumber context:nil characters:@"q" charactersIgnoringModifiers:@"q" isARepeat:NO keyCode:12];
    [NSApp postEvent:event atStart:NO];
    return nothing(env);
  }
  if ([input[@"action"] isEqual:@"alert"]) {
    if (![input[@"value"] isKindOfClass:NSString.class] || !TRActivateFixtureAlert(host,input[@"value"])) return fail(env,"Fixture alert button is unavailable");
    return nothing(env);
  }
  TRNode *node = [host find:input[@"id"]]; if (!node) return fail(env,"Fixture control is unavailable");
  NSString *action = input[@"action"];
  if ([action isEqual:@"fill"] && ([node.spec[@"kind"] isEqual:@"input"] || [node.spec[@"kind"] isEqual:@"secure"])) {
    if ([node.control isKindOfClass:NSControl.class] && !((NSControl *)node.control).enabled) return fail(env,"Fixture input is disabled");
    if (![input[@"value"] isKindOfClass:NSString.class]) return fail(env,"Invalid fixture text");
    if ([node.control isKindOfClass:NSScrollView.class]) ((NSTextView *)((NSScrollView *)node.control).documentView).string = input[@"value"];
    else ((NSTextField *)node.control).stringValue = input[@"value"];
    [node editChanged];
  } else if (([action isEqual:@"type"] || [action isEqual:@"mark"]) && ([node.spec[@"kind"] isEqual:@"input"] || [node.spec[@"kind"] isEqual:@"secure"])) {
    if (![input[@"value"] isKindOfClass:NSString.class]) return fail(env,"Invalid fixture text");
    NSTextView *editor;
    if ([node.control isKindOfClass:NSScrollView.class]) editor = (NSTextView *)((NSScrollView *)node.control).documentView;
    else { if (!((NSControl *)node.control).enabled) return fail(env,"Fixture input is disabled"); [node.window makeFirstResponder:node.control]; editor = (NSTextView *)((NSTextField *)node.control).currentEditor; }
    if (!editor.editable) return fail(env,"Fixture input is disabled");
    [editor.window makeFirstResponder:editor];
    if ([action isEqual:@"mark"]) { [editor setMarkedText:input[@"value"] selectedRange:NSMakeRange([input[@"value"] length],0) replacementRange:NSMakeRange(NSNotFound,0)]; [node editChanged]; }
    else [editor insertText:input[@"value"] replacementRange:NSMakeRange(NSNotFound,0)];
  } else if ([action isEqual:@"click"] && [node.control isKindOfClass:NSButton.class]) [(NSButton *)node.control performClick:nil];
  else if ([action isEqual:@"choose"] && [node.control isKindOfClass:NSPopUpButton.class]) {
    NSPopUpButton *select = (NSPopUpButton *)node.control;
    for (NSMenuItem *item in select.itemArray) if ([item.representedObject isEqual:input[@"value"]] && item.enabled) { [select selectItem:item]; [node trigger:select]; break; }
  } else if ([action isEqual:@"select"] && [node.spec[@"kind"] isEqual:@"table"]) {
    NSTableView *table = (NSTableView *)((NSScrollView *)node.control).documentView;
    NSInteger row = 0; for (NSDictionary *item in node.spec[@"rows"]) { if ([item[@"id"] isEqual:input[@"value"]]) { [table selectRowIndexes:[NSIndexSet indexSetWithIndex:row] byExtendingSelection:NO]; if ([input[@"activate"] boolValue]) [node activateRow]; break; } row++; }
  } else if ([action isEqual:@"scroll"] && [node.control isKindOfClass:NSScrollView.class]) {
    NSScrollView *scroll = (NSScrollView *)node.control; CGFloat y = MIN(MAX(0,[input[@"value"] doubleValue]), MAX(0,scroll.documentView.bounds.size.height-scroll.contentSize.height));
    [scroll.contentView scrollToPoint:NSMakePoint(0,y)]; [scroll reflectScrolledClipView:scroll.contentView];
  } else if ([action isEqual:@"scroller"] && [node.control isKindOfClass:NSScrollView.class]) {
    if (![input[@"value"] isEqual:@"legacy"] && ![input[@"value"] isEqual:@"overlay"]) return fail(env,"Unsupported fixture scroller style");
    ((NSScrollView *)node.control).scrollerStyle = [input[@"value"] isEqual:@"legacy"] ? NSScrollerStyleLegacy : NSScrollerStyleOverlay;
    node.needsLayout = YES; [host.root layoutSubtreeIfNeeded];
  } else if ([action isEqual:@"divider"] && [node.control isKindOfClass:NSSplitView.class]) {
    CGFloat value = [input[@"value"] doubleValue];
    if (value < [node.spec[@"minWidth"] doubleValue] || value > [node.spec[@"maxWidth"] doubleValue]) return fail(env,"Invalid fixture divider position");
    [(NSSplitView *)node.control setPosition:value ofDividerAtIndex:0];
  } else if ([action isEqual:@"key"]) {
    NSDictionary *codes = @{@"left":@123,@"right":@124,@"down":@125,@"up":@126,@"home":@115,@"end":@119,@"escape":@53,@"enter":@36,@"tab":@48};
    NSNumber *code = codes[input[@"value"]]; if (!code) return fail(env,"Unsupported fixture key");
    NSView *control = node.control ?: node; if ([control isKindOfClass:NSScrollView.class]) control = ((NSScrollView *)control).documentView;
    [control.window makeFirstResponder:control];
    NSDictionary *characters = @{@"left":@"\uF702",@"right":@"\uF703",@"up":@"\uF700",@"down":@"\uF701",@"home":@"\uF729",@"end":@"\uF72B",@"escape":@"\x1b",@"enter":@"\r",@"tab":@"\t"};
    NSEvent *event = [NSEvent keyEventWithType:NSEventTypeKeyDown location:NSZeroPoint modifierFlags:[input[@"shift"] boolValue] ? NSEventModifierFlagShift : 0 timestamp:0 windowNumber:control.window.windowNumber context:nil characters:characters[input[@"value"]] charactersIgnoringModifiers:characters[input[@"value"]] isARepeat:NO keyCode:code.unsignedShortValue];
    [(control.window.firstResponder ?: control) keyDown:event];
  } else if ([action isEqual:@"appearance"]) {
    NSDictionary *names = @{@"light":NSAppearanceNameAqua,@"dark":NSAppearanceNameDarkAqua,@"contrast-light":NSAppearanceNameAccessibilityHighContrastAqua,@"contrast-dark":NSAppearanceNameAccessibilityHighContrastDarkAqua};
    NSString *name = names[input[@"value"]]; if (!name) return fail(env,"Unsupported fixture appearance");
    host.fixtureContrast = @([input[@"value"] hasPrefix:@"contrast-"]);
    host.canvas.appearance = [NSAppearance appearanceNamed:name]; [host updateMaterials];
  } else if ([action isEqual:@"transparency"] && [input[@"value"] isKindOfClass:NSNumber.class]) {
    host.fixtureTransparency = input[@"value"]; [host updateMaterials];
  } else if ([action isEqual:@"accent"]) {
    // This entry point is already restricted to disposable fixture hosts.
    // Never change the user's macOS accent preference.
    NSDictionary *colors = @{@"blue":NSColor.systemBlueColor,@"yellow":NSColor.systemYellowColor,@"orange":NSColor.systemOrangeColor,@"purple":NSColor.systemPurpleColor,@"gray":NSColor.systemGrayColor};
    if (![input[@"value"] isEqual:@"system"] && !colors[input[@"value"]]) return fail(env,"Unsupported fixture accent");
    host.fixtureAccent = colors[input[@"value"]]; [host updateMaterials];
  } else if ([action isEqual:@"focus"]) {
    NSView *control = node.control ?: node; if ([control isKindOfClass:NSScrollView.class]) control = ((NSScrollView *)control).documentView;
    [control.window makeFirstResponder:control];
  } else return fail(env,"Unsupported fixture action for this control");
  if (![input[@"deferFlush"] boolValue]) [host flush]; return nothing(env);
}
static napi_value init(napi_env env, napi_value exports) {
  napi_property_descriptor methods[] = {{"attach",0,attach,0,0,0,napi_default,0},{"present",0,present,0,0,0,napi_default,0},{"inspect",0,inspect,0,0,0,napi_default,0},{"flush",0,flush,0,0,0,napi_default,0},{"detach",0,detach,0,0,0,napi_default,0},{"edit",0,edit,0,0,0,napi_default,0},{"interactFixture",0,interactFixture,0,0,0,napi_default,0}};
  napi_define_properties(env,exports,7,methods); return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME,init)
