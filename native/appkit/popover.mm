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
  NSString *_anchor, *_close;
  __weak NSView *_anchorView;
  BOOL _programmatic, _fixtureAnchorDismissal, _fixtureSuppress;
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
  NSDictionary *content = spec[@"root"];
  if (!self.node || ![self.node.identifier isEqual:content[@"id"]]) {
    self.node = [[TRNode alloc] initWithHost:_host spec:content];
  } else [self.node update:content];
  CGFloat zoom = _host.zoom, width = MIN(560 * zoom, MAX(320, _host.window.frame.size.width - 40));
  CGFloat cap = MAX(240, MIN(560 * zoom, _host.window.frame.size.height - 120));
  if (!self.popover) {
    NSPopover *popover = [NSPopover new];
    // Semi-transient: a click in the window or Escape closes it, but switching to another app
    // keeps an in-progress choice open (and keeps fixture captures deterministic).
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
  }
}
- (void)close {
  if (self.popover.shown) { _programmatic = YES; [self.popover close]; _programmatic = NO; }
  self.node = nil; _anchorView = nil;
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
  NSEvent *event = NSApp.currentEvent; BOOL onAnchor = [self eventHitsAnchor:event];
  _suppressedAnchor = onAnchor || _fixtureAnchorDismissal ? _anchor : nil;
  _suppressedEvent = onAnchor ? event.eventNumber : -1; _fixtureSuppress = _fixtureAnchorDismissal;
  [_host emit:_close value:nil secret:NO];
}
- (void)popoverDidClose:(NSNotification *)notification { if (!self.popover.shown) { self.node = nil; _anchorView = nil; } }
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
- (NSDictionary *)inspect {
  if (!self.popover.shown || !self.node) return nil;
  NSRect anchor = _anchorView ? [_anchorView.window convertRectToScreen:[_anchorView convertRect:_anchorView.bounds toView:nil]] : NSZeroRect;
  NSScrollView *scroll = (NSScrollView *)self.popover.contentViewController.view;
  NSRect frame = scroll.window.frame; NSWindow *window = scroll.window;
  return @{@"anchor":_anchor ?: @"",@"root":[self.node inspect] ?: @{},@"behavior":@(self.popover.behavior),
           @"below":@(NSMaxY(frame) <= NSMinY(anchor) + 2),@"contentSize":NSStringFromSize(self.popover.contentSize),
           @"documentHeight":@(scroll.documentView.frame.size.height),@"visibleHeight":@(scroll.contentSize.height),
           @"keyWindow":@(window.isKeyWindow),@"windowNumber":@(window.windowNumber),@"firstResponder":NSStringFromClass(window.firstResponder.class)};
}
@end
