#import "ui.h"

// Content taller than the window cap scrolls; Escape inside dismisses like an outside click.
@interface TRPopoverScroll : NSScrollView
@property(nonatomic, weak) TRPopover *owner;
@end
@implementation TRPopoverScroll
- (void)cancelOperation:(id)sender { [self.owner.popover performClose:sender]; }
@end
@interface TRPopoverDocument : NSView
@end
@implementation TRPopoverDocument
- (BOOL)isFlipped { return YES; }
@end

@implementation TRPopover {
  __weak TRHost *_host;
  NSString *_anchor, *_close, *_cancel;
  __weak NSView *_anchorView;
  BOOL _programmatic, _fixtureAnchorDismissal, _fixtureSuppress, _background;
  id _resignObserver;
  NSString *_suppressedAnchor;
  NSInteger _suppressedEvent;
}
- (instancetype)initWithHost:(TRHost *)host { self = [super init]; if (self) { _host = host; _suppressedEvent = -1; } return self; }
- (NSView *)anchorViewFor:(NSString *)identifier {
  TRNode *node = [_host.root find:identifier]; NSView *view = node.control ?: node;
  return view.window && !view.isHiddenOrHasHiddenAncestor ? view : nil;
}
- (void)apply:(NSDictionary *)spec {
  NSView *anchor = [spec isKindOfClass:NSDictionary.class] ? [self anchorViewFor:spec[@"anchor"]] : nil;
  if (!anchor) { [self close]; return; }
  // A rebuilt anchor view (new scene root) needs a fresh positioning view.
  if (self.popover.shown && anchor != _anchorView) [self close];
  _anchor = spec[@"anchor"]; _close = spec[@"close"];
  _cancel = [spec[@"cancel"] isKindOfClass:NSString.class] ? spec[@"cancel"] : nil;
  NSDictionary *content = spec[@"root"];
  if (!self.node || ![self.node.identifier isEqual:content[@"id"]]) {
    self.node = [[TRNode alloc] initWithHost:_host spec:content];
  } else [self.node update:content];
  CGFloat zoom = _host.zoom, width = MIN(560 * zoom, MAX(320, _host.window.frame.size.width - 40));
  CGFloat cap = MAX(240, MIN(560 * zoom, _host.window.frame.size.height - 120));
  // Fit below the anchor on small screens (the content scrolls) instead of letting AppKit flip
  // the popover above the button and over the title bar.
  NSRect anchorOnScreen = [anchor.window convertRectToScreen:[anchor convertRect:anchor.bounds toView:nil]];
  NSScreen *screen = anchor.window.screen ?: NSScreen.mainScreen;
  if (screen) cap = MAX(240, MIN(cap, NSMinY(anchorOnScreen) - NSMinY(screen.visibleFrame) - 40));
  if (!self.popover) {
    NSPopover *popover = [NSPopover new];
    // Semi-transient handles window clicks and Escape. The foreground observer below also
    // discards an unapplied choice when the application becomes inactive.
    popover.behavior = NSPopoverBehaviorSemitransient; popover.delegate = self;
    TRPopoverScroll *scroll = [[TRPopoverScroll alloc] initWithFrame:NSMakeRect(0,0,width,cap)]; scroll.owner = self;
    scroll.hasVerticalScroller = YES; scroll.autohidesScrollers = YES; scroll.drawsBackground = NO; scroll.borderType = NSNoBorder;
    scroll.documentView = [[TRPopoverDocument alloc] initWithFrame:NSMakeRect(0,0,width,cap)];
    NSViewController *controller = [NSViewController new]; controller.view = scroll;
    popover.contentViewController = controller; self.popover = popover;
  }
  NSScrollView *scroll = (NSScrollView *)self.popover.contentViewController.view; NSView *document = scroll.documentView;
  if (self.node.superview != document) { [document.subviews makeObjectsPerformSelector:@selector(removeFromSuperview)]; [document addSubview:self.node]; }
  CGFloat contentHeight = [self.node heightForWidth:width];
  self.popover.contentSize = NSMakeSize(width, MIN(contentHeight, cap));
  scroll.frame = NSMakeRect(0,0,width,MIN(contentHeight, cap));
  // A legacy scroller takes width only when the content actually scrolls.
  CGFloat documentWidth = scroll.contentSize.width;
  contentHeight = [self.node heightForWidth:documentWidth];
  document.frame = NSMakeRect(0,0,documentWidth,contentHeight);
  self.node.frame = document.bounds; self.node.needsLayout = YES; [self.node layoutSubtreeIfNeeded];
  if (!self.popover.shown) {
    // Fixtures need a deterministic open state; users get the system animation unless Reduce Motion is on.
    self.popover.animates = !_host.fixture && !NSWorkspace.sharedWorkspace.accessibilityDisplayShouldReduceMotion;
    _anchorView = anchor;
    [self.popover showRelativeToRect:anchor.bounds ofView:anchor preferredEdge:anchor.isFlipped ? NSRectEdgeMaxY : NSRectEdgeMinY];
    // When the app loses the foreground the popover closes as a cancel: returning to the app
    // must not find a popover whose field no longer receives typing. It never reopens itself.
    if (!_resignObserver) {
      __weak TRPopover *weakSelf = self;
      _resignObserver = [NSNotificationCenter.defaultCenter addObserverForName:NSApplicationDidResignActiveNotification object:NSApp queue:nil usingBlock:^(NSNotification *notification) { [weakSelf closeForBackground]; }];
    }
  }
}
- (void)closeForBackground {
  if (!self.popover.shown) return;
  _background = YES; [self.popover performClose:nil]; _background = NO;
}
- (void)stopObservingBackground {
  if (_resignObserver) [NSNotificationCenter.defaultCenter removeObserver:_resignObserver];
  _resignObserver = nil;
}
- (void)dealloc { [self stopObservingBackground]; }
- (void)close {
  if (self.popover.shown) { _programmatic = YES; [self.popover close]; _programmatic = NO; }
  self.node = nil; _anchorView = nil; [self stopObservingBackground];
}
- (BOOL)eventHitsAnchor:(NSEvent *)event {
  NSView *anchor = _anchorView;
  if (!anchor || event.type != NSEventTypeLeftMouseDown || event.window != anchor.window) return NO;
  return NSPointInRect([anchor convertPoint:event.locationInWindow fromView:nil], anchor.bounds);
}
- (void)popoverWillClose:(NSNotification *)notification {
  if (_programmatic) return;
  // A mouse-down on the anchor dismisses the popover; that click's mouse-up would toggle it open
  // again. Ignore exactly that mouse-up (same event number), not later clicks or Escape.
  NSEvent *event = NSApp.currentEvent; BOOL onAnchor = !_background && [self eventHitsAnchor:event];
  _suppressedAnchor = onAnchor || _fixtureAnchorDismissal ? _anchor : nil;
  _suppressedEvent = onAnchor ? event.eventNumber : -1; _fixtureSuppress = _fixtureAnchorDismissal;
  // Escape is a cancel with its own action (for example to return focus to the anchor); an
  // outside click keeps the plain close so the clicked control keeps its focus.
  BOOL escape = !_background && event.type == NSEventTypeKeyDown && event.keyCode == 53;
  [_host emit:(escape && _cancel.length ? _cancel : _close) value:nil secret:NO];
}
- (void)popoverDidClose:(NSNotification *)notification { if (!self.popover.shown) { self.node = nil; _anchorView = nil; [self stopObservingBackground]; } }
- (BOOL)suppressesTriggerFrom:(NSString *)identifier {
  if (!_suppressedAnchor || ![identifier isEqual:_suppressedAnchor]) return NO;
  NSEvent *event = NSApp.currentEvent;
  BOOL same = _fixtureSuppress || (event.type == NSEventTypeLeftMouseUp && event.eventNumber == _suppressedEvent);
  _suppressedAnchor = nil; _suppressedEvent = -1; _fixtureSuppress = NO;
  return same;
}
- (BOOL)dismissFixture:(BOOL)fromAnchor {
  if (!self.popover.shown) return NO;
  // Fixture clicks have no real mouse events; model a dismissing mouse-down on the anchor.
  _fixtureAnchorDismissal = fromAnchor; [self.popover performClose:nil]; _fixtureAnchorDismissal = NO;
  return YES;
}
- (NSWindow *)inputClientWindow {
  id client = NSTextInputContext.currentInputContext.client;
  return [client isKindOfClass:NSView.class] ? ((NSView *)client).window : nil;
}
- (NSDictionary *)inspect {
  if (!self.popover.shown || !self.node) return nil;
  NSRect anchor = _anchorView ? [_anchorView.window convertRectToScreen:[_anchorView convertRect:_anchorView.bounds toView:nil]] : NSZeroRect;
  NSScrollView *scroll = (NSScrollView *)self.popover.contentViewController.view;
  NSRect frame = scroll.window.frame; NSWindow *window = scroll.window;
  return @{@"anchor":_anchor ?: @"",@"root":[self.node inspect] ?: @{},@"behavior":@(self.popover.behavior),
           // Below = the popover's centre is under the anchor's centre (window frames include the
           // arrow and shadow margins, so edge comparisons depend on the display).
           @"below":@(NSMidY(frame) < NSMidY(anchor)),@"popoverFrame":NSStringFromRect(frame),@"anchorFrame":NSStringFromRect(anchor),
           @"screenFrame":NSStringFromRect((window.screen ?: NSScreen.mainScreen).visibleFrame),@"contentSize":NSStringFromSize(self.popover.contentSize),
           @"documentHeight":@(scroll.documentView.frame.size.height),@"visibleHeight":@(scroll.contentSize.height),
           @"keyWindow":@(window.isKeyWindow),@"windowNumber":@(window.windowNumber),@"firstResponder":NSStringFromClass(window.firstResponder.class),
           // Where typed text goes: the active text input context's client window.
           @"inputInPopover":@([self inputClientWindow] == window),@"appKeyIsPopover":@(NSApp.keyWindow == window)};
}
@end
