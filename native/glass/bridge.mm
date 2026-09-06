// Owned AppKit/Node-API adapter. Only public Cocoa APIs; no V8/Chromium internals.
#import <AppKit/AppKit.h>
#import <objc/runtime.h>
#include <node_api.h>
#include <cmath>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

@class TRGlassController;
static char controllerKey;

@interface TRNativeButton : NSButton
@property(nonatomic, weak) TRGlassController *owner;
@property(nonatomic, copy) NSString *controlId;
@property(nonatomic) BOOL publishedSelection;
@end

@interface TRPassView : NSView
@end
@implementation TRPassView
- (BOOL)isFlipped { return YES; }
- (NSView *)hitTest:(NSPoint)point {
  NSView *hit = [super hitTest:point];
  return hit == self ? nil : hit;
}
@end

// Glass surfaces stay in physical window coordinates. Only their ordinary
// foreground content scales, so AppKit's glass clipping stays correctly sized.
@interface TRScaledContentView : TRPassView
@property(nonatomic) CGFloat logicalScale;
@end
@implementation TRScaledContentView
@synthesize logicalScale = _logicalScale;
- (void)updateLogicalBounds {
  CGFloat scale = _logicalScale > 0 ? _logicalScale : 1;
  self.bounds = NSMakeRect(0, 0, self.frame.size.width / scale, self.frame.size.height / scale);
}
- (void)setLogicalScale:(CGFloat)scale { _logicalScale = scale; [self updateLogicalBounds]; }
- (void)setFrameSize:(NSSize)size { [super setFrameSize:size]; [self updateLogicalBounds]; }
@end

@interface TRSolidView : TRPassView
@property(nonatomic, strong) NSView *contentView;
@property(nonatomic) CGFloat cornerRadius;
@end
@implementation TRSolidView
- (void)setContentView:(NSView *)view {
  if (_contentView == view) return;
  [_contentView removeFromSuperview]; _contentView = view;
  if (view) { [self addSubview:view]; view.frame = self.bounds; }
}
- (void)setFrameSize:(NSSize)size { [super setFrameSize:size]; self.contentView.frame = self.bounds; }
- (void)drawRect:(NSRect)dirtyRect {
  [NSColor.windowBackgroundColor setFill];
  [[NSBezierPath bezierPathWithRoundedRect:self.bounds xRadius:self.cornerRadius yRadius:self.cornerRadius] fill];
}
@end

@interface TRHeaderView : TRSolidView
@end
@implementation TRHeaderView
- (void)drawRect:(NSRect)dirtyRect {
  [NSColor.windowBackgroundColor setFill];
  NSRectFill(self.bounds);
  [NSColor.separatorColor setFill];
  NSRectFill(NSMakeRect(0, self.bounds.size.height - 0.5, self.bounds.size.width, 0.5));
}
@end

@interface TRNativeLabel : NSTextField
@end
@implementation TRNativeLabel
- (NSView *)hitTest:(NSPoint)point { return nil; }
@end

@interface TRGlassView : NSGlassEffectView
@end
@implementation TRGlassView
- (NSView *)hitTest:(NSPoint)point {
  NSView *hit = [super hitTest:point];
  return hit == self || (hit == self.contentView && ![hit isKindOfClass:NSControl.class]) ? nil : hit;
}
@end

@interface TRGlassContainer : NSGlassEffectContainerView
@end
@implementation TRGlassContainer
- (NSView *)hitTest:(NSPoint)point {
  return [self.contentView hitTest:[self.superview convertPoint:point toView:self.contentView.superview]];
}
@end

@interface TRGlassController : NSObject
@property(nonatomic, weak) NSWindow *window;
@property(nonatomic, strong) NSView *originalRoot;
@property(nonatomic, strong) NSView *host;
@property(nonatomic, strong) TRGlassContainer *container;
@property(nonatomic, strong) TRPassView *overlay;
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSView *> *groups;
@property(nonatomic, strong) NSMutableDictionary<NSString *, TRNativeButton *> *buttons;
@property(nonatomic, strong) NSMutableDictionary<NSString *, TRNativeLabel *> *labels;
@property(nonatomic, copy) NSArray<NSString *> *order;
@property(nonatomic, copy) NSArray *observers;
@property(nonatomic, copy) NSString *lastAnnouncement;
@property(nonatomic, copy) NSString *focusedBeforeModal;
@property(nonatomic) napi_threadsafe_function callback;
@property(nonatomic) NSInteger revision;
@property(nonatomic) CGFloat scale;
@property(nonatomic) BOOL modal;
@property(nonatomic) BOOL suspended;
@property(nonatomic) BOOL reduceTransparency;
@property(nonatomic) BOOL layingOut;
@property(nonatomic) BOOL disposed;
@property(nonatomic) BOOL focusContent;
@property(nonatomic) NSUInteger forwardedScrollCount;
- (void)mount;
- (void)present:(NSDictionary *)scene;
- (void)layout;
- (void)invalidate;
- (void)activate:(TRNativeButton *)sender;
- (void)advanceFrom:(TRNativeButton *)sender reverse:(BOOL)reverse;
- (BOOL)forwardKey:(NSEvent *)event from:(TRNativeButton *)sender;
- (void)forwardScroll:(NSEvent *)event from:(TRNativeButton *)sender;
- (BOOL)focusEdge:(BOOL)last;
- (NSDictionary *)diagnostics;
@end

@implementation TRNativeButton
- (NSAccessibilityRole)accessibilityRole { return NSAccessibilityButtonRole; }
- (BOOL)interactionAllowed { return self.owner && self.enabled && !self.hidden && !self.owner.modal && !self.owner.suspended && !self.owner.disposed; }
- (BOOL)isAccessibilityEnabled { return [self interactionAllowed]; }
- (id)accessibilityValue { return @(self.state == NSControlStateValueOn); }
- (BOOL)acceptsFirstResponder { return [self interactionAllowed]; }
- (BOOL)canBecomeKeyView { return [self interactionAllowed]; }
- (void)mouseDown:(NSEvent *)event {
  if (![self interactionAllowed]) return;
  [self.window makeFirstResponder:self];
  [super mouseDown:event];
}
- (BOOL)accessibilityPerformPress {
  if (![self interactionAllowed]) return NO;
  [self.window makeFirstResponder:self];
  [self performClick:nil];
  return YES;
}
- (void)keyDown:(NSEvent *)event {
  if (self.owner.suspended || self.owner.modal || self.owner.disposed) return;
  if (event.keyCode == 48) { [self.owner advanceFrom:self reverse:(event.modifierFlags & NSEventModifierFlagShift) != 0]; return; }
  if (event.keyCode == 49 || event.keyCode == 36) { if (!event.isARepeat) [self performClick:nil]; return; }
  if ([self.owner forwardKey:event from:self]) return;
  [super keyDown:event];
}
- (BOOL)performKeyEquivalent:(NSEvent *)event {
  if (self.window.firstResponder == self && [self.owner forwardKey:event from:self]) return YES;
  return [super performKeyEquivalent:event];
}
- (void)scrollWheel:(NSEvent *)event { [self.owner forwardScroll:event from:self]; }
@end

static NSRect readRect(NSDictionary *value) {
  return NSMakeRect([value[@"x"] doubleValue], [value[@"y"] doubleValue], [value[@"width"] doubleValue], [value[@"height"] doubleValue]);
}
static NSDictionary *rectValue(NSRect rect) {
  return @{ @"x": @(rect.origin.x), @"y": @(rect.origin.y), @"width": @(rect.size.width), @"height": @(rect.size.height) };
}
static NSString *symbolFor(NSString *identifier, BOOL selected) {
  NSDictionary *symbols = @{ @"discover": @"safari", @"saved": @"star", @"analytics": @"chart.bar", @"sources": @"books.vertical", @"settings": @"gearshape", @"source-status": @"circle.fill", @"sidebar-toggle": @"sidebar.left", @"save-item": selected ? @"star.fill" : @"star", @"analyze-item": @"sparkles", @"promote-item": @"square.and.arrow.up", @"dismiss-item": @"eye.slash", @"undo": @"arrow.uturn.backward" };
  return symbols[identifier];
}
static NSView *contentOf(NSView *view) {
  if ([view isKindOfClass:NSGlassEffectView.class]) return ((NSGlassEffectView *)view).contentView;
  if ([view isKindOfClass:TRSolidView.class]) return ((TRSolidView *)view).contentView;
  return view;
}

@implementation TRGlassController
- (void)mount {
  self.groups = [NSMutableDictionary dictionary];
  self.buttons = [NSMutableDictionary dictionary];
  self.labels = [NSMutableDictionary dictionary];
  self.order = @[];
  self.scale = 1;
  self.originalRoot = self.window.contentView;
  NSResponder *responder = self.window.firstResponder;
  self.host = [[NSView alloc] initWithFrame:self.originalRoot.frame];
  self.host.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
  self.overlay = [[TRPassView alloc] initWithFrame:self.host.bounds];
  self.container = [[TRGlassContainer alloc] initWithFrame:self.host.bounds];
  self.container.contentView = self.overlay;
  self.container.spacing = 0;
  [self.originalRoot removeFromSuperview];
  [self.host addSubview:self.originalRoot];
  [self.host addSubview:self.container];
  self.window.contentView = self.host;
  [self layout];
  if ([responder isKindOfClass:NSView.class] && ((NSView *)responder).window == self.window) [self.window makeFirstResponder:responder];
  self.originalRoot.postsFrameChangedNotifications = YES;
  __weak TRGlassController *weakSelf = self;
  NSNotificationCenter *center = NSNotificationCenter.defaultCenter;
  id frame = [center addObserverForName:NSViewFrameDidChangeNotification object:self.originalRoot queue:nil usingBlock:^(NSNotification *note) { [weakSelf layout]; }];
  id resize = [center addObserverForName:NSWindowDidResizeNotification object:self.window queue:nil usingBlock:^(NSNotification *note) { [weakSelf layout]; }];
  id close = [center addObserverForName:NSWindowWillCloseNotification object:self.window queue:nil usingBlock:^(NSNotification *note) {
    TRGlassController *strongSelf = weakSelf;
    [strongSelf invalidate];
    objc_setAssociatedObject(note.object, &controllerKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  }];
  self.observers = @[frame, resize, close];

}
- (void)layout {
  if (self.disposed || self.layingOut || !self.window) return;
  self.layingOut = YES;
  NSRect frame = NSMakeRect(0, 0, self.window.frame.size.width, self.window.frame.size.height);
  if (!NSEqualRects(self.host.frame, frame)) self.host.frame = frame;
  if (!NSEqualRects(self.originalRoot.frame, frame)) self.originalRoot.frame = frame;
  self.container.frame = frame;
  self.overlay.frame = frame;
  self.overlay.bounds = frame;
  self.layingOut = NO;
}
- (void)emit:(NSDictionary *)event {
  if (self.disposed || !self.callback) return;
  NSData *data = [NSJSONSerialization dataWithJSONObject:event options:0 error:nil];
  auto payload = new std::string((const char *)data.bytes, data.length);
  if (napi_call_threadsafe_function(self.callback, payload, napi_tsfn_nonblocking) != napi_ok) delete payload;
}
- (NSView *)group:(NSString *)identifier {
  NSView *group = self.groups[identifier];
  BOOL header = [identifier isEqualToString:@"header"];
  if (group && (header || self.reduceTransparency == [group isKindOfClass:TRSolidView.class])) return group;
  [group removeFromSuperview];
  if (header) { TRHeaderView *view = [TRHeaderView new]; view.contentView = [TRScaledContentView new]; group = view; }
  else if (self.reduceTransparency) {
    TRSolidView *solid = [TRSolidView new]; solid.contentView = [TRScaledContentView new]; group = solid;
  } else {
    TRGlassView *glass = [TRGlassView new]; glass.contentView = [TRScaledContentView new]; group = glass;
  }
  group.clipsToBounds = YES;
  contentOf(group).clipsToBounds = YES;
  self.groups[identifier] = group;
  [self.overlay addSubview:group];
  return group;
}
- (void)updateButton:(NSDictionary *)item group:(NSView *)group origin:(NSRect)origin order:(NSMutableArray *)order {
  NSString *identifier = item[@"id"];
  TRNativeButton *button = self.buttons[identifier];
  if (!button) {
    button = [TRNativeButton buttonWithTitle:item[@"label"] target:self action:@selector(activate:)];
    button.owner = self;
    button.controlId = identifier;
    button.buttonType = NSButtonTypePushOnPushOff;
    button.bezelStyle = NSBezelStyleRounded;
    button.accessibilityElement = YES;
    self.buttons[identifier] = button;
  }
  NSView *parent = contentOf(group);
  if ([identifier isEqualToString:@"sidebar-toggle"]) {
    NSString *key = @"header-toggle-glass";
    NSView *glass = [self group:key];
    // The toggle's glass cannot be nested under the scaled label content.
    if (glass.superview != group) { [glass removeFromSuperview]; [group addSubview:glass]; }
    NSRect frame = readRect(item[@"rect"]);
    glass.frame = NSMakeRect((frame.origin.x - origin.origin.x) * self.scale, (frame.origin.y - origin.origin.y) * self.scale, frame.size.width * self.scale, frame.size.height * self.scale);
    if ([glass isKindOfClass:TRSolidView.class]) ((TRSolidView *)glass).cornerRadius = 9 * self.scale;
    else ((TRGlassView *)glass).cornerRadius = 9 * self.scale;
    TRScaledContentView *content = (TRScaledContentView *)contentOf(glass);
    content.logicalScale = self.scale;
    content.frame = NSMakeRect(0, 0, glass.bounds.size.width, glass.bounds.size.height);
    if (button.superview != content) { [button removeFromSuperview]; [content addSubview:button]; }
    button.frame = NSMakeRect(0, 0, frame.size.width, frame.size.height);
  } else {
    if (button.superview != parent) { [button removeFromSuperview]; [parent addSubview:button]; }
    NSRect frame = readRect(item[@"rect"]);
    button.frame = NSMakeRect((frame.origin.x - origin.origin.x), (frame.origin.y - origin.origin.y), frame.size.width, frame.size.height);
  }
  BOOL selected = [item[@"selected"] boolValue];
  button.publishedSelection = selected;
  button.state = selected ? NSControlStateValueOn : NSControlStateValueOff;
  button.enabled = [item[@"enabled"] boolValue];
  button.font = [NSFont systemFontOfSize:13 weight:selected ? NSFontWeightSemibold : NSFontWeightRegular];
  button.title = [item[@"iconOnly"] boolValue] ? @"" : item[@"label"];
  button.accessibilityLabel = item[@"label"];
  button.toolTip = item[@"label"];
  button.bordered = selected;
  button.contentTintColor = selected ? nil : NSColor.labelColor;
  button.alignment = [item[@"iconOnly"] boolValue] ? NSTextAlignmentCenter : NSTextAlignmentLeft;
  button.imageHugsTitle = YES;
  button.imagePosition = [item[@"iconOnly"] boolValue] ? NSImageOnly : NSImageLeading;
  NSImage *image = [NSImage imageWithSystemSymbolName:symbolFor(identifier, selected) accessibilityDescription:nil];
  button.image = [image imageWithSymbolConfiguration:[NSImageSymbolConfiguration configurationWithPointSize:16 weight:NSFontWeightRegular]];
  [order addObject:identifier];
}
- (void)updateLabel:(NSDictionary *)item group:(NSView *)group origin:(NSRect)origin seen:(NSMutableSet *)seen {
  NSString *identifier = item[@"id"];
  TRNativeLabel *label = self.labels[identifier];
  if (!label) {
    label = [TRNativeLabel labelWithString:item[@"text"]];
    label.lineBreakMode = NSLineBreakByTruncatingTail;
    label.maximumNumberOfLines = 1;
    self.labels[identifier] = label;
  }
  NSView *parent = contentOf(group);
  if (label.superview != parent) { [label removeFromSuperview]; [parent addSubview:label]; }
  NSRect frame = readRect(item[@"rect"]);
  label.frame = NSMakeRect((frame.origin.x - origin.origin.x) - 2, (frame.origin.y - origin.origin.y), frame.size.width + 4, frame.size.height + 2);
  label.stringValue = item[@"text"];
  label.font = [NSFont systemFontOfSize:[item[@"fontSize"] doubleValue] weight:[item[@"bold"] boolValue] ? NSFontWeightSemibold : NSFontWeightRegular];
  label.textColor = [item[@"tone"] isEqualToString:@"error"] ? NSColor.systemRedColor : [item[@"tone"] isEqualToString:@"secondary"] ? NSColor.secondaryLabelColor : NSColor.labelColor;
  [seen addObject:identifier];
  if ([identifier isEqualToString:@"toast-copy"] && ![self.lastAnnouncement isEqualToString:label.stringValue]) {
    self.lastAnnouncement = label.stringValue;
    NSAccessibilityPostNotificationWithUserInfo(self.window, NSAccessibilityAnnouncementRequestedNotification, @{ NSAccessibilityAnnouncementKey: label.stringValue, NSAccessibilityPriorityKey: @(NSAccessibilityPriorityMedium) });
  }
}
- (void)present:(NSDictionary *)scene {
  if (self.disposed) return;
  self.focusContent = NO;
  NSString *focused = [self.window.firstResponder isKindOfClass:TRNativeButton.class] ? ((TRNativeButton *)self.window.firstResponder).controlId : nil;
  BOOL dark = [scene[@"appearance"] isEqualToString:@"dark"];
  BOOL contrast = [scene[@"contrast"] isEqualToString:@"more"];
  NSAppearanceName appearance = contrast ? (dark ? NSAppearanceNameAccessibilityHighContrastDarkAqua : NSAppearanceNameAccessibilityHighContrastAqua) : (dark ? NSAppearanceNameDarkAqua : NSAppearanceNameAqua);
  self.host.appearance = [NSAppearance appearanceNamed:appearance];
  self.reduceTransparency = [scene[@"reduceTransparency"] boolValue];
  self.revision = [scene[@"revision"] integerValue];
  self.scale = [scene[@"scale"] doubleValue];
  BOOL modal = [scene[@"modal"] boolValue];
  if (modal && !self.modal && [self.window.firstResponder isKindOfClass:TRNativeButton.class]) self.focusedBeforeModal = ((TRNativeButton *)self.window.firstResponder).controlId;
  self.modal = modal;
  self.container.hidden = modal || self.suspended;
  if (modal) { self.suspended = NO; return; }
  NSMutableArray *order = [NSMutableArray array];
  NSMutableSet *seenGroups = [NSMutableSet set];
  NSMutableSet *seenLabels = [NSMutableSet set];
  for (NSDictionary *surface in scene[@"surfaces"]) {
    NSString *identifier = surface[@"id"];
    [seenGroups addObject:identifier];
    NSView *group = [self group:identifier];
    NSRect frame = readRect(surface[@"rect"]);
    group.frame = NSMakeRect(frame.origin.x * self.scale, frame.origin.y * self.scale, frame.size.width * self.scale, frame.size.height * self.scale);
    if ([group isKindOfClass:NSGlassEffectView.class]) ((NSGlassEffectView *)group).cornerRadius = [identifier isEqualToString:@"sidebar"] ? 0 : 12 * self.scale;
    if ([group isKindOfClass:TRSolidView.class]) ((TRSolidView *)group).cornerRadius = [identifier isEqualToString:@"sidebar"] || [identifier isEqualToString:@"header"] ? 0 : 12 * self.scale;
    TRScaledContentView *content = (TRScaledContentView *)contentOf(group);
    content.logicalScale = self.scale;
    content.frame = NSMakeRect(0, 0, group.bounds.size.width, group.bounds.size.height);
    for (NSDictionary *item in surface[@"controls"]) [self updateButton:item group:group origin:frame order:order];
    for (NSDictionary *item in surface[@"labels"]) [self updateLabel:item group:group origin:frame seen:seenLabels];
    [group setNeedsDisplay:YES];
  }
  if ([order containsObject:@"sidebar-toggle"]) [seenGroups addObject:@"header-toggle-glass"];
  for (NSString *identifier in self.buttons.allKeys) {
    if (![order containsObject:identifier]) {
      TRNativeButton *button = self.buttons[identifier];
      if ([focused isEqualToString:identifier]) self.focusContent = YES;
      [button removeFromSuperview]; [self.buttons removeObjectForKey:identifier];
    }
  }
  for (NSString *identifier in self.labels.allKeys) if (![seenLabels containsObject:identifier]) { [self.labels[identifier] removeFromSuperview]; [self.labels removeObjectForKey:identifier]; }
  for (NSString *identifier in self.groups.allKeys) if (![seenGroups containsObject:identifier]) { [self.groups[identifier] removeFromSuperview]; [self.groups removeObjectForKey:identifier]; }
  self.order = order;
  self.suspended = NO;
  self.container.hidden = NO;
  if (focused && self.buttons[focused].enabled) [self.window makeFirstResponder:self.buttons[focused]];
  else if (focused) self.focusContent = YES;
  if (self.focusedBeforeModal) {
    TRNativeButton *button = self.buttons[self.focusedBeforeModal];
    if (button.enabled) [self.window makeFirstResponder:button];
    self.focusedBeforeModal = nil;
  }
  [self layout];
}
- (NSArray<TRNativeButton *> *)focusable {
  NSMutableArray *values = [NSMutableArray array];
  for (NSString *identifier in self.order) {
    TRNativeButton *button = self.buttons[identifier];
    if (button.enabled && !button.hidden && button.window) [values addObject:button];
  }
  return values;
}
- (BOOL)focusEdge:(BOOL)last {
  if (self.modal || self.suspended || self.disposed) return NO;
  NSArray *buttons = [self focusable];
  TRNativeButton *target = last ? buttons.lastObject : buttons.firstObject;
  return target ? [self.window makeFirstResponder:target] : NO;
}
- (void)advanceFrom:(TRNativeButton *)sender reverse:(BOOL)reverse {
  if (self.modal || self.suspended || self.disposed) return;
  NSArray *buttons = [self focusable];
  NSUInteger index = [buttons indexOfObject:sender];
  if (index == NSNotFound) {
    [self emit:@{ @"kind": @"focus-content", @"edge": reverse ? @"last" : @"first", @"revision": @(self.revision) }];
    return;
  }
  if ((!reverse && index + 1 == buttons.count) || (reverse && index == 0)) {
    [self emit:@{ @"kind": @"focus-content", @"edge": reverse ? @"last" : @"first", @"revision": @(self.revision) }];
  } else [self.window makeFirstResponder:buttons[reverse ? index - 1 : index + 1]];
}
- (BOOL)forwardKey:(NSEvent *)event from:(TRNativeButton *)sender {
  if (self.modal || self.suspended || self.disposed || !sender.enabled) return NO;
  NSEventModifierFlags flags = event.modifierFlags;
  if (flags & (NSEventModifierFlagControl | NSEventModifierFlagOption)) return NO;
  BOOL meta = (flags & NSEventModifierFlagCommand) != 0;
  BOOL shift = (flags & NSEventModifierFlagShift) != 0;
  NSString *key = event.charactersIgnoringModifiers.lowercaseString;
  NSDictionary *arrows = @{ @123: @"ArrowLeft", @124: @"ArrowRight", @125: @"ArrowDown", @126: @"ArrowUp" };
  if (meta) { if (![key isEqualToString:@"z"] || shift) return NO; }
  else if (arrows[@(event.keyCode)]) key = arrows[@(event.keyCode)];
  else if (![@[@"s", @"d", @"a"] containsObject:key]) return NO;
  [self emit:@{ @"kind": @"key", @"id": sender.controlId, @"key": key, @"metaKey": @(meta), @"shiftKey": @(shift), @"repeat": @(event.isARepeat), @"revision": @(self.revision) }];
  return YES;
}
- (void)forwardScroll:(NSEvent *)event from:(TRNativeButton *)sender {
  if (self.modal || self.suspended || self.disposed) return;
  CGFloat unit = event.hasPreciseScrollingDeltas ? 1 : 40;
  CGFloat x = -event.scrollingDeltaX * unit / self.scale;
  CGFloat y = -event.scrollingDeltaY * unit / self.scale;
  if ((event.modifierFlags & NSEventModifierFlagShift) && x == 0) { x = y; y = 0; }
  if (x == 0 && y == 0) return;
  self.forwardedScrollCount += 1;
  [self emit:@{ @"kind": @"scroll", @"id": sender.controlId, @"deltaX": @(x), @"deltaY": @(y), @"revision": @(self.revision) }];
}

- (void)activate:(TRNativeButton *)sender {
  sender.state = sender.publishedSelection ? NSControlStateValueOn : NSControlStateValueOff;
  if (self.modal || self.suspended || self.disposed || !sender.enabled) return;
  [self emit:@{ @"kind": @"activate", @"id": sender.controlId, @"revision": @(self.revision) }];
}
- (NSDictionary *)diagnostics {
  NSView *content = contentOf(self.groups[@"sidebar"] ?: self.groups[@"header"]) ?: self.overlay;
  NSSize logicalPoint = [content convertSize:NSMakeSize(1, 1) toView:self.host];
  NSMutableArray *groups = [NSMutableArray array];
  for (NSString *identifier in self.groups) {
    NSView *group = self.groups[identifier];
    [groups addObject:@{ @"id": identifier, @"class": NSStringFromClass(group.class), @"ownsContent": @(![group isKindOfClass:NSGlassEffectView.class] || ((NSGlassEffectView *)group).contentView != nil), @"frame": rectValue(group.frame) }];
  }
  return @{ @"active": @(!self.disposed), @"revision": @(self.revision), @"modal": @(self.modal), @"suspended": @(self.suspended), @"windowActive": @(self.window.isKeyWindow), @"hostClass": NSStringFromClass(self.host.class), @"originalFrame": rectValue(self.originalRoot.frame), @"hostFrame": rectValue(self.host.frame), @"groups": groups, @"controls": self.order ?: @[], @"focusedControl": [self.window.firstResponder isKindOfClass:TRNativeButton.class] ? ((TRNativeButton *)self.window.firstResponder).controlId : @"web", @"reduceTransparency": @(self.reduceTransparency), @"appearance": self.host.effectiveAppearance.name, @"forwardedScrollCount": @(self.forwardedScrollCount), @"contentScale": @(logicalPoint.width) };
}
- (void)invalidate {
  if (self.disposed) return;
  self.disposed = YES;
  for (id observer in self.observers) [NSNotificationCenter.defaultCenter removeObserver:observer];
  self.observers = nil;
  if (self.window.contentView == self.host) {
    NSResponder *responder = self.window.firstResponder;
    [self.originalRoot removeFromSuperview];
    self.window.contentView = self.originalRoot;
    self.originalRoot.frame = NSMakeRect(0, 0, self.window.frame.size.width, self.window.frame.size.height);
    if ([responder isKindOfClass:NSView.class] && ((NSView *)responder).window == self.window) [self.window makeFirstResponder:responder];
  }
  [self.container removeFromSuperview];
  [self.buttons removeAllObjects]; [self.groups removeAllObjects]; [self.labels removeAllObjects];
  if (self.callback) { napi_release_threadsafe_function(self.callback, napi_tsfn_abort); self.callback = nullptr; }
}
@end

static napi_value fail(napi_env env, const char *message) { napi_throw_error(env, nullptr, message); return nullptr; }
static bool arguments(napi_env env, napi_callback_info info, size_t expected, napi_value *values) {
  size_t count = expected;
  return napi_get_cb_info(env, info, &count, values, nullptr, nullptr) == napi_ok && count == expected;
}
// Compare opaque addresses against live, main-owned windows before dereferencing anything.
static NSWindow *windowFor(napi_env env, napi_value value) {
  bool buffer = false; void *bytes = nullptr; size_t length = 0;
  napi_is_buffer(env, value, &buffer);
  if (!buffer || napi_get_buffer_info(env, value, &bytes, &length) != napi_ok || length != sizeof(void *)) { fail(env, "Invalid native window handle"); return nil; }
  if (![NSThread isMainThread]) { fail(env, "AppKit requires the main thread"); return nil; }
  void *pointer = nullptr; std::memcpy(&pointer, bytes, sizeof(pointer));
  for (NSWindow *window in NSApp.windows) {
    TRGlassController *controller = objc_getAssociatedObject(window, &controllerKey);
    if (pointer == (__bridge void *)window.contentView || (controller && pointer == (__bridge void *)controller.originalRoot)) return window;
  }
  fail(env, "Native window is no longer available"); return nil;
}
static NSString *readString(napi_env env, napi_value value, size_t limit) {
  napi_valuetype type; napi_typeof(env, value, &type);
  size_t length = 0;
  if (type != napi_string || napi_get_value_string_utf8(env, value, nullptr, 0, &length) != napi_ok || length > limit) { fail(env, "Invalid native string"); return nil; }
  std::vector<char> bytes(length + 1);
  napi_get_value_string_utf8(env, value, bytes.data(), bytes.size(), &length);
  return [[NSString alloc] initWithBytes:bytes.data() length:length encoding:NSUTF8StringEncoding];
}
static void invokeJs(napi_env env, napi_value callback, void *context, void *data) {
  auto payload = static_cast<std::string *>(data);
  if (env && callback) {
    napi_value text, receiver, result;
    napi_create_string_utf8(env, payload->data(), payload->size(), &text);
    napi_get_undefined(env, &receiver);
    napi_call_function(env, receiver, callback, 1, &text, &result);
  }
  delete payload;
}
static napi_value attach(napi_env env, napi_callback_info info) {
  napi_value values[2], result; if (!arguments(env, info, 2, values)) return fail(env, "Invalid attach arguments");
  NSWindow *window = windowFor(env, values[0]); if (!window) return nullptr;
  napi_valuetype type; napi_typeof(env, values[1], &type);
  if (type != napi_function) return fail(env, "Native event callback required");
  if (objc_getAssociatedObject(window, &controllerKey)) { napi_get_undefined(env, &result); return result; }
  if (@available(macOS 26.0, *)) {
    TRGlassController *controller = [TRGlassController new]; controller.window = window;
    napi_value resource; napi_create_string_utf8(env, "TheRSSNativeGlass", NAPI_AUTO_LENGTH, &resource);
    napi_threadsafe_function callback;
    if (napi_create_threadsafe_function(env, values[1], nullptr, resource, 128, 1, nullptr, nullptr, nullptr, invokeJs, &callback) != napi_ok) return fail(env, "Native callback initialization failed");
    controller.callback = callback;
    @try { [controller mount]; objc_setAssociatedObject(window, &controllerKey, controller, OBJC_ASSOCIATION_RETAIN_NONATOMIC); }
    @catch (NSException *exception) { [controller invalidate]; return fail(env, "Native host initialization failed"); }
    napi_get_undefined(env, &result); return result;
  }
  return fail(env, "Native glass requires macOS26 or later");
}
static napi_value present(napi_env env, napi_callback_info info) {
  napi_value values[2], result; if (!arguments(env, info, 2, values)) return fail(env, "Invalid presentation arguments");
  NSWindow *window = windowFor(env, values[0]); if (!window) return nullptr;
  NSString *serialized = readString(env, values[1], 65536); if (!serialized) return nullptr;
  NSDictionary *scene = [NSJSONSerialization JSONObjectWithData:[serialized dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
  if (![scene isKindOfClass:NSDictionary.class] || ![scene[@"surfaces"] isKindOfClass:NSArray.class] || [scene[@"surfaces"] count] > 4 || [scene[@"revision"] integerValue] < 1 || !std::isfinite([scene[@"scale"] doubleValue]) || [scene[@"scale"] doubleValue] <= 0 || [scene[@"scale"] doubleValue] > 8) return fail(env, "Invalid native scene");
  TRGlassController *controller = objc_getAssociatedObject(window, &controllerKey);
  if (!controller) return fail(env, "Native host is not attached");
  @try { [controller present:scene]; } @catch (NSException *exception) { return fail(env, "Native presentation failed"); }
  napi_get_boolean(env, controller.focusContent, &result); return result;
}
static napi_value focus(napi_env env, napi_callback_info info) {
  napi_value values[2], result; if (!arguments(env, info, 2, values)) return fail(env, "Invalid focus arguments");
  NSWindow *window = windowFor(env, values[0]); if (!window) return nullptr;
  NSString *edge = readString(env, values[1], 8); if (!edge) return nullptr;
  if (![edge isEqualToString:@"first"] && ![edge isEqualToString:@"last"]) return fail(env, "Invalid focus edge");
  TRGlassController *controller = objc_getAssociatedObject(window, &controllerKey);
  napi_get_boolean(env, [controller focusEdge:[edge isEqualToString:@"last"]], &result); return result;
}
static napi_value suspendHost(napi_env env, napi_callback_info info) {
  napi_value value, result; if (!arguments(env, info, 1, &value)) return fail(env, "Invalid suspend arguments");
  NSWindow *window = windowFor(env, value); if (!window) return nullptr;
  TRGlassController *controller = objc_getAssociatedObject(window, &controllerKey);
  BOOL focusContent = [window.firstResponder isKindOfClass:TRNativeButton.class] && ((TRNativeButton *)window.firstResponder).owner == controller;
  @try { controller.suspended = YES; controller.container.hidden = YES; }
  @catch (NSException *exception) { return fail(env, "Native suspension failed"); }
  napi_get_boolean(env, focusContent, &result); return result;
}
static napi_value release(napi_env env, napi_callback_info info) {
  napi_value value, result; if (!arguments(env, info, 1, &value)) return fail(env, "Invalid release arguments");
  NSWindow *window = windowFor(env, value); if (!window) return nullptr;
  TRGlassController *controller = objc_getAssociatedObject(window, &controllerKey);
  [controller invalidate]; objc_setAssociatedObject(window, &controllerKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
  napi_get_undefined(env, &result); return result;
}
static napi_value inspect(napi_env env, napi_callback_info info) {
  napi_value value, result; if (!arguments(env, info, 1, &value)) return fail(env, "Invalid inspect arguments");
  NSWindow *window = windowFor(env, value); if (!window) return nullptr;
  TRGlassController *controller = objc_getAssociatedObject(window, &controllerKey);
  NSDictionary *diagnostics = controller ? [controller diagnostics] : @{ @"active": @NO };
  NSData *data = [NSJSONSerialization dataWithJSONObject:diagnostics options:0 error:nil];
  napi_create_string_utf8(env, (const char *)data.bytes, data.length, &result); return result;
}
static napi_value testAction(napi_env env, napi_callback_info info) {
  const char *enabled = std::getenv("THERSS_E2E_FIXTURES");
  if (!enabled || std::strcmp(enabled, "1") != 0) return fail(env, "Native fixture actions are disabled");
  napi_value values[3], result; if (!arguments(env, info, 3, values)) return fail(env, "Invalid fixture action");
  NSWindow *window = windowFor(env, values[0]); if (!window) return nullptr;
  NSString *identifier = readString(env, values[1], 32); if (!identifier) return nullptr;
  NSString *action = readString(env, values[2], 16); if (!action) return nullptr;
  TRGlassController *controller = objc_getAssociatedObject(window, &controllerKey);
  TRNativeButton *button = controller.buttons[identifier];
  if (!button || controller.modal || controller.suspended) { napi_get_boolean(env, false, &result); return result; }
  if ([action isEqualToString:@"hit"]) {
    NSPoint center = NSMakePoint(NSMidX(button.bounds), NSMidY(button.bounds));
    NSPoint point = [button convertPoint:center toView:controller.host.superview];
    napi_get_boolean(env, [controller.host hitTest:point] == button, &result); return result;
  }
  if ([action isEqualToString:@"focus"]) { napi_get_boolean(env, [window makeFirstResponder:button], &result); return result; }
  if ([action hasPrefix:@"key:"] || [action isEqualToString:@"repeat-space"]) {
    NSString *key = [action isEqualToString:@"repeat-space"] ? @" " : [action substringFromIndex:4];
    NSDictionary *codes = @{ @"ArrowDown": @125, @"ArrowUp": @126, @"s": @1, @"d": @2, @"a": @0, @"Meta-z": @6, @" ": @49 };
    NSNumber *code = codes[key]; if (!code) return fail(env, "Unknown fixture key");
    BOOL meta = [key isEqualToString:@"Meta-z"];
    NSEvent *event = [NSEvent keyEventWithType:NSEventTypeKeyDown location:NSZeroPoint modifierFlags:meta ? NSEventModifierFlagCommand : 0 timestamp:0 windowNumber:window.windowNumber context:nil characters:meta ? @"z" : key charactersIgnoringModifiers:meta ? @"z" : key isARepeat:[action isEqualToString:@"repeat-space"] keyCode:code.unsignedShortValue];
    [button keyDown:event];
  }
  else if ([action isEqualToString:@"wheel-right"] || [action isEqualToString:@"wheel-down"]) {
    // Real public NSEvent conversion, delivered only to this fixture object.
    // This is an integration test; it never posts a synthetic event to the OS.
    CGEventRef cg = CGEventCreateScrollWheelEvent(nullptr, kCGScrollEventUnitPixel, 2, [action isEqualToString:@"wheel-down"] ? -100 : 0, [action isEqualToString:@"wheel-right"] ? -100 : 0);
    NSEvent *event = [NSEvent eventWithCGEvent:cg];
    CFRelease(cg);
    [button scrollWheel:event];
  }
  else if ([action isEqualToString:@"press"]) [button accessibilityPerformPress];
  else if ([action isEqualToString:@"tab"] || [action isEqualToString:@"backtab"]) [controller advanceFrom:button reverse:[action isEqualToString:@"backtab"]];
  else return fail(env, "Unknown native fixture action");
  napi_get_boolean(env, true, &result); return result;
}
static napi_value initialize(napi_env env, napi_value exports) {
  napi_property_descriptor methods[] = {
    {"attach", nullptr, attach, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"present", nullptr, present, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"focus", nullptr, focus, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"suspend", nullptr, suspendHost, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"release", nullptr, release, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"inspect", nullptr, inspect, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"testAction", nullptr, testAction, nullptr, nullptr, nullptr, napi_default, nullptr}
  };
  napi_define_properties(env, exports, 7, methods); return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, initialize)
