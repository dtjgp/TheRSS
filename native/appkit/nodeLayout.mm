#import "nodeInternal.h"
#include <cmath>

@implementation TRNode (Layout)
- (CGFloat)safeInset { return [self.spec[@"safeArea"] boolValue] ? [self.host safeTop] : 0; }
- (CGFloat)preferredWidth {
  if (self.spec[@"width"]) return [self.spec[@"width"] doubleValue] * self.host.zoom;
  if ([self.spec[@"kind"] isEqual:@"symbol"]) return ceil(TRNumber(self.spec,@"size",40) * 1.3 * self.host.zoom);
  if ([self.control isKindOfClass:NSControl.class]) return MAX(60, self.control.intrinsicContentSize.width + 8);
  return 180 * self.host.zoom;
}
// A row's natural width: its children side by side. Used only by centered columns, so other
// rows keep their existing preferred width.
- (CGFloat)naturalRowWidth {
  CGFloat gap = TRNumber(self.spec,@"gap",10) * self.host.zoom, width = 2 * TRNumber(self.spec,@"padding",0) * self.host.zoom + MAX(0,(NSInteger)self.nodes.count-1) * gap;
  for (TRNode *child in self.nodes) width += child.preferredWidth;
  return width;
}
// Width of a child in a centered column: its own natural or maximum width, never the column's.
- (CGFloat)centeredWidthFor:(TRNode *)child within:(CGFloat)available {
  CGFloat width = available, zoom = self.host.zoom; NSString *kind = child.spec[@"kind"];
  if (child.spec[@"maxWidth"]) width = MIN(width,[child.spec[@"maxWidth"] doubleValue]*zoom);
  if ([kind isEqual:@"row"]) width = MIN(width,[child naturalRowWidth]);
  else if ([kind isEqual:@"symbol"] || [kind isEqual:@"button"]) width = MIN(width,child.preferredWidth);
  return MAX(0,width);
}
// A nested row (a group that wraps as one unit) needs its children side by side.
- (CGFloat)wrapWidthOf:(TRNode *)child {
  return [child.spec[@"kind"] isEqual:@"row"] ? [child naturalRowWidth] : child.preferredWidth;
}
- (BOOL)wrapsRowAtWidth:(CGFloat)width {
  if (self.spec[@"wrap"] && ![self.spec[@"wrap"] boolValue]) return NO;
  CGFloat padding = TRNumber(self.spec,@"padding",0) * self.host.zoom, gap = TRNumber(self.spec,@"gap",10) * self.host.zoom;
  CGFloat fixed = MAX(0,(NSInteger)self.nodes.count-1)*gap;
  for (TRNode *child in self.nodes) {
    BOOL group = [child.spec[@"kind"] isEqual:@"row"];
    fixed += [child.spec[@"flex"] doubleValue] > 0 && !group ? MIN(180*self.host.zoom,child.preferredWidth) : [self wrapWidthOf:child];
  }
  return fixed > width - 2*padding;
}
- (CGFloat)wrappedRowAtWidth:(CGFloat)width apply:(BOOL)apply {
  CGFloat padding = TRNumber(self.spec,@"padding",0) * self.host.zoom, gap = TRNumber(self.spec,@"gap",10) * self.host.zoom;
  CGFloat x = padding, y = padding, lineHeight = 0, available = MAX(20,width-2*padding);
  for (TRNode *child in self.nodes) {
    CGFloat childWidth = MIN(available,[self wrapWidthOf:child]), childHeight = [child heightForWidth:childWidth];
    if (x > padding && x+childWidth > width-padding) { x = padding; y += lineHeight+gap; lineHeight = 0; }
    if (apply) child.frame = NSMakeRect(x,y,childWidth,childHeight);
    x += childWidth+gap; lineHeight = MAX(lineHeight,childHeight);
  }
  return y+lineHeight+padding;
}
- (CGFloat)scrollChildWidth:(TRNode *)child within:(CGFloat)contentWidth {
  return MIN(contentWidth,TRNumber(child.spec,@"maxWidth",contentWidth/self.host.zoom)*self.host.zoom);
}
- (CGFloat)scrollContentHeightForWidth:(CGFloat)contentWidth {
  CGFloat y = 0; for (TRNode *child in self.nodes) y += [child heightForWidth:[self scrollChildWidth:child within:contentWidth]];
  return y;
}
- (CGFloat)heightForWidth:(CGFloat)width {
  CGFloat zoom = self.host.zoom, padding = TRNumber(self.spec, @"padding", 0) * zoom, gap = TRNumber(self.spec,@"gap",10) * zoom;
  if (self.spec[@"height"]) return [self.spec[@"height"] doubleValue] * zoom;
  NSString *kind = self.spec[@"kind"];
  if ([kind isEqual:@"symbol"]) return ceil(TRNumber(self.spec,@"size",40) * 1.2 * zoom);
  if ([kind isEqual:@"column"]) {
    BOOL centered = [self.spec[@"align"] isEqual:@"center"];
    CGFloat height = 2 * padding + [self safeInset] + MAX(0, (NSInteger)self.nodes.count - 1) * gap;
    for (TRNode *child in self.nodes) height += [child heightForWidth:centered ? MAX(20,[self centeredWidthFor:child within:width-2*padding]) : MAX(20,width-2*padding)];
    return MAX(height, TRNumber(self.spec,@"minHeight",0) * zoom);
  }
  if ([kind isEqual:@"row"]) {
    if ([self wrapsRowAtWidth:width]) return [self wrappedRowAtWidth:width apply:NO];
    CGFloat height = 32 * zoom; for (TRNode *child in self.nodes) height = MAX(height,[child heightForWidth:[child preferredWidth]]); return height + 2 * padding;
  }
  if ([kind isEqual:@"label"]) {
    NSRect rect = [((NSTextField *)self.control).attributedStringValue boundingRectWithSize:NSMakeSize(MAX(20,width),100000) options:NSStringDrawingUsesLineFragmentOrigin|NSStringDrawingUsesFontLeading];
    CGFloat maximum = self.spec[@"maxLines"] ? ceil(self.font.ascender-self.font.descender+self.font.leading)*[self.spec[@"maxLines"] integerValue] : 100000;
    return MIN(ceil(rect.size.height),maximum) + 4;
  }
  if ([kind isEqual:@"text"]) {
    NSTextView *text = (NSTextView *)self.control;
    if (fabs(text.textContainer.containerSize.width - MAX(20,width)) > 0.5) text.textContainer.containerSize = NSMakeSize(MAX(20,width),CGFLOAT_MAX);
    [text.layoutManager ensureLayoutForTextContainer:text.textContainer];
    NSRect rect = [text.layoutManager usedRectForTextContainer:text.textContainer];
    return ceil(rect.size.height) + 2*text.textContainerInset.height;
  }
  if ([kind isEqual:@"split"]) return TRNumber(self.spec,@"minHeight",!self.spec[@"compactPane"] && self.spec[@"collapseAt"] && width < [self.spec[@"collapseAt"] doubleValue] ? 340 : 200) * zoom;
  if ([kind isEqual:@"scroll"] || [kind isEqual:@"table"] || [kind isEqual:@"sidebar"]) return TRNumber(self.spec,@"minHeight",200) * zoom;
  if ([kind isEqual:@"progress"]) return 16 * zoom;
  if ([kind isEqual:@"input"] && [self.spec[@"multiline"] boolValue]) return 120 * zoom;
  return 32 * zoom;
}
- (void)layout {
  [super layout];
  CGFloat width = self.bounds.size.width, height = self.bounds.size.height;
  BOOL splitLayout = [self.spec[@"kind"] isEqual:@"split"];
  BOOL wasApplying = self.applying;
  if (splitLayout) self.applying = YES;
  self.control.frame = self.bounds;
  NSString *kind = self.spec[@"kind"];
  if ([kind isEqual:@"segmented"]) {
    // Segments keep their natural height, centred in the row like the adjacent buttons.
    CGFloat natural = MIN(height,self.control.intrinsicContentSize.height);
    self.control.frame = NSMakeRect(0,floor((height-natural)/2),width,natural);
  }
  if ([self.spec[@"adaptiveScroll"] boolValue]) {
    NSScrollView *scroll = (NSScrollView *)self.control;
    width = scroll.contentSize.width; height = MAX(scroll.contentSize.height,[self heightForWidth:width]);
  }
  CGFloat padding = TRNumber(self.spec,@"padding",0) * self.host.zoom, gap = TRNumber(self.spec,@"gap",10) * self.host.zoom;
  if ([kind isEqual:@"scroll"]) {
    NSScrollView *scroll = (NSScrollView *)self.control;
    CGFloat contentWidth = scroll.contentSize.width, y = 0;
    for (TRNode *child in self.nodes) {
      CGFloat childWidth = [self scrollChildWidth:child within:contentWidth];
      CGFloat h = [child heightForWidth:childWidth]; child.frame = NSMakeRect(0,y,childWidth,h); y += h;
    }
    self.container.frame = NSMakeRect(0,0,contentWidth,MAX(y,scroll.contentSize.height));
  } else if (self.splitController && self.nodes.count == 2) {
    [self reconcileWindowSplit];
  } else if ([kind isEqual:@"split"] && self.nodes.count == 2) {
    NSSplitView *split = (NSSplitView *)self.control;
    NSString *pane = self.spec[@"compactPane"];
    if (pane) {
      split.vertical = YES;
      NSUInteger visible = [pane isEqual:@"detail"] ? 1 : 0;
      for (NSUInteger i = 0; i < self.nodes.count; i++) {
        self.nodes[i].hidden = i != visible;
        if (i == visible) self.nodes[i].frame = self.bounds;
      }
      self.nodes[visible].needsLayout = YES;
      [self.nodes[visible] layoutSubtreeIfNeeded];
      self.applying = wasApplying;
      return;
    }
    for (TRNode *child in self.nodes) child.hidden = NO;
    BOOL vertical = !self.spec[@"collapseAt"] || width >= [self.spec[@"collapseAt"] doubleValue];
    BOOL changed = split.vertical != vertical; split.vertical = vertical;
    CGFloat limit = vertical ? width : height;
    CGFloat desired = vertical ? self.preferredSplit : MAX(160,limit * self.stackedFraction);
    desired = MIN(desired, MAX(TRNumber(self.spec,@"minWidth",80),limit - TRNumber(self.spec,@"minContentWidth",200)));
    if (changed) ((TRSplit *)split).initialPosition = desired;
    [split setPosition:desired ofDividerAtIndex:0];
    self.lastWidth = desired;
    [split adjustSubviews];
  } else if ([kind isEqual:@"column"] || [kind isEqual:@"row"]) {
    if (self.container) self.container.frame = NSMakeRect(0,0,width,height);
    BOOL row = [kind isEqual:@"row"];
    if (row && [self wrapsRowAtWidth:width]) {
      [self wrappedRowAtWidth:width apply:YES];
      for (TRNode *child in self.nodes) { child.needsLayout = YES; [child layoutSubtreeIfNeeded]; }
      return;
    }
    CGFloat total = MAX(0,(NSInteger)self.nodes.count-1) * gap, flex = 0;
    if (!row && [self.spec[@"align"] isEqual:@"center"]) {
      // Centered stack (macOS empty states): natural sizes, centered both ways.
      CGFloat inner = MAX(20,width-2*padding), safe = [self safeInset];
      for (TRNode *child in self.nodes) total += [child heightForWidth:MAX(20,[self centeredWidthFor:child within:inner])];
      CGFloat position = padding + safe + MAX(0,floor((height - 2*padding - safe - total)/2));
      for (TRNode *child in self.nodes) {
        CGFloat childWidth = MAX(20,[self centeredWidthFor:child within:inner]), extent = [child heightForWidth:childWidth];
        child.frame = NSMakeRect(floor((width-childWidth)/2),position,childWidth,extent); position += extent + gap;
      }
      for (TRNode *child in self.nodes) { child.needsLayout = YES; [child layoutSubtreeIfNeeded]; }
      return;
    }
    for (TRNode *child in self.nodes) { if ([child.spec[@"flex"] doubleValue] > 0) flex += [child.spec[@"flex"] doubleValue]; else total += row ? child.preferredWidth : [child heightForWidth:MAX(20,width-2*padding)]; }
    CGFloat safe = row ? 0 : [self safeInset];
    CGFloat available = MAX(0, (row ? width : height) - 2*padding - safe - total), position = padding + safe;
    for (TRNode *child in self.nodes) {
      CGFloat extent = [child.spec[@"flex"] doubleValue] > 0 && flex ? available * [child.spec[@"flex"] doubleValue] / flex : (row ? child.preferredWidth : [child heightForWidth:MAX(20,width-2*padding)]);
      CGFloat childWidth = MAX(0,width-2*padding);
      if (!row && ![child.spec[@"kind"] isEqual:@"split"]) {
        if (child.spec[@"width"]) childWidth = MIN(childWidth,[child.spec[@"width"] doubleValue]*self.host.zoom);
        if (child.spec[@"maxWidth"]) childWidth = MIN(childWidth,[child.spec[@"maxWidth"] doubleValue]*self.host.zoom);
        // AppKit push buttons in a vertical stack keep their intrinsic width and
        // align leading; only sidebar navigation rows span the column.
        if ([child.spec[@"kind"] isEqual:@"button"] && ![child.spec[@"emphasis"] isEqual:@"navigation"]) childWidth = MIN(childWidth,child.preferredWidth);
      }
      CGFloat rowHeight = MAX(0,height-2*padding), rowY = padding;
      if (row && [child.spec[@"kind"] isEqual:@"label"]) {
        // Labels draw from the top of their frame; a text-height frame centered in
        // the row shares the vertical center of adjacent bezeled controls.
        CGFloat textHeight = MIN(rowHeight,[child heightForWidth:extent]);
        rowY = padding + floor((rowHeight-textHeight)/2); rowHeight = textHeight;
      }
      child.frame = row ? NSMakeRect(position,rowY,extent,rowHeight) : NSMakeRect(padding,position,childWidth,extent);
      position += extent + gap;
    }
  } else if ([kind isEqual:@"sidebar"]) {
    NSScrollView *scroll = (NSScrollView *)self.control; NSTableView *table = (NSTableView *)scroll.documentView;
    [scroll tile]; table.tableColumns.firstObject.width = MAX(60,scroll.contentView.bounds.size.width-2*MAX(0,[table rectOfColumn:0].origin.x));
  } else if ([kind isEqual:@"table"]) {
    NSScrollView *scroll = (NSScrollView *)self.control;
    NSTableView *table = (NSTableView *)scroll.documentView;
    [scroll tile]; [table tile];
    // AppKit's list styles add horizontal column insets. Derive them from the
    // actual column geometry so the rightmost value remains inside the clip view.
    CGFloat inset = table.tableColumns.count ? MAX(0,[table rectOfColumn:0].origin.x) : 0;
    CGFloat available = MAX(60, scroll.contentView.bounds.size.width-2*inset);
    NSArray *columns = self.spec[@"columns"];
    if (columns) {
      CGFloat total = 0; for (NSDictionary *entry in columns) total += [entry[@"width"] doubleValue]*self.host.zoom;
      CGFloat extra = MAX(0,available-total)/columns.count;
      for (NSUInteger i = 0; i < columns.count; i++) table.tableColumns[i].width = [columns[i][@"width"] doubleValue]*self.host.zoom+extra;
      table.headerView.frame = NSMakeRect(0,0,MAX(available,total)+2*inset,24*self.host.zoom);
    } else table.tableColumns.firstObject.width = available;
    if (self.revealSelection && !self.isHiddenOrHasHiddenAncestor) { [table scrollRowToVisible:table.selectedRow]; self.revealSelection = NO; }
  } else if ([kind isEqual:@"input"] && [self.spec[@"multiline"] boolValue]) {
    NSScrollView *scroll = (NSScrollView *)self.control;
    NSTextView *input = (NSTextView *)scroll.documentView;
    input.minSize = NSMakeSize(0,scroll.contentSize.height); input.maxSize = NSMakeSize(CGFLOAT_MAX,CGFLOAT_MAX);
    [input setFrameSize:NSMakeSize(scroll.contentSize.width,MAX(input.frame.size.height,scroll.contentSize.height))];
  }
  for (TRNode *child in self.nodes) { child.needsLayout = YES; [child layoutSubtreeIfNeeded]; }
  if (self.resetScrollAfterLayout && [self.control isKindOfClass:NSScrollView.class]) {
    // Legacy scrollers can adjust the clip origin when the replacement document
    // changes size. Reset only after AppKit has laid out both document and bars.
    NSScrollView *scroll = (NSScrollView *)self.control; [scroll layoutSubtreeIfNeeded];
    [scroll.contentView scrollToPoint:NSZeroPoint]; [scroll reflectScrolledClipView:scroll.contentView];
    self.resetScrollAfterLayout = NO;
  }
  if (splitLayout) self.applying = wasApplying;
}
- (CGFloat)splitView:(NSSplitView *)split constrainMinCoordinate:(CGFloat)proposed ofSubviewAt:(NSInteger)index { return split.vertical ? TRNumber(self.spec,@"minWidth",180) : 160; }
- (CGFloat)splitView:(NSSplitView *)split constrainMaxCoordinate:(CGFloat)proposed ofSubviewAt:(NSInteger)index { return split.vertical ? MAX(TRNumber(self.spec,@"minWidth",180),MIN(TRNumber(self.spec,@"maxWidth",520),split.bounds.size.width-TRNumber(self.spec,@"minContentWidth",200))) : split.bounds.size.height-160; }
- (void)splitViewDidResizeSubviews:(NSNotification *)notification {
  if (self.spec[@"compactPane"]) return;
  NSSplitView *split = [self splitView];
  if (!self.applying && !split.vertical && self.window && split.bounds.size.height > 0) self.stackedFraction = split.arrangedSubviews.firstObject.frame.size.height/split.bounds.size.height;
  // A controller-hosted split also resizes for window changes; only user resizes are preferences.
  if (!self.applying && split.vertical && self.lastWidth && self.window && (!self.splitController || self.userResizing)) {
    CGFloat value = split.arrangedSubviews.firstObject.frame.size.width;
    if (value >= TRNumber(self.spec,@"minWidth",180) && value <= TRNumber(self.spec,@"maxWidth",520)) { self.preferredSplit = value; self.widthEvents++; [self.host emit:self.spec[@"action"] value:@(value) secret:NO]; }
  }
}
// Keep the window sidebar at its preferred width whenever the window has room (a narrow window
// squeezes it; widening restores it). Called after node and split view controller layouts.
- (void)reconcileWindowSplit {
  // Wait for a running show/hide animation; its completion reconciles once.
  if (!self.splitController || self.nodes.count != 2 || self.animatingSplit || [self.spec[@"compactPane"] isEqual:@"detail"]) return;
  // Moving the divider changes Auto Layout constraints, which AppKit forbids inside a layout
  // pass, so it runs right after.
  NSSplitView *split = self.splitController.splitView;
  CGFloat room = split.bounds.size.width - TRNumber(self.spec,@"minContentWidth",200) - split.dividerThickness;
  CGFloat desired = MAX(TRNumber(self.spec,@"minWidth",180), MIN(self.preferredSplit, room));
  CGFloat actual = split.arrangedSubviews.firstObject.frame.size.width;
  if (!self.lastWidth && split.bounds.size.width > 0) self.lastWidth = desired;
  // A settled layout ends this attempt. A later constraints pass or a return from a narrow
  // window must be able to restore the same target again at the same window width.
  if (fabs(actual - desired) <= 0.5) { self.reconcileAttempt = 0; self.reconcileRetries = 0; return; }
  // Bounded attempts per unresolved split width and target: a narrow window where AppKit keeps
  // its minimum width stops quickly without looping, while a widening resize can recover from a
  // transient constraints pass.
  CGFloat attempt = split.bounds.size.width * 4096 + desired;
  if (attempt != self.reconcileAttempt) { self.reconcileAttempt = attempt; self.reconcileRetries = 0; }
  if (room > 0 && fabs(actual - desired) > 0.5 && !self.reconcilePending && self.reconcileRetries < 3) {
    self.reconcilePending = YES; self.reconcileRetries++;
    __weak TRNode *weakSelf = self;
    dispatch_async(dispatch_get_main_queue(), ^{
      TRNode *node = weakSelf; if (!node || node.host.disposed) return;
      node.reconcilePending = NO;
      if (!node.splitController || node.animatingSplit || [node.spec[@"compactPane"] isEqual:@"detail"] || node.splitController.splitViewItems.firstObject.collapsed) return;
      // Flush pending controller layout before reading split bounds and moving the divider.
      node.applying = YES;
      [node.splitController.view layoutSubtreeIfNeeded];
      // Re-read the target: the window or preference may have changed since scheduling.
      NSSplitView *current = node.splitController.splitView;
      CGFloat space = current.bounds.size.width - TRNumber(node.spec,@"minContentWidth",200) - current.dividerThickness;
      CGFloat target = MAX(TRNumber(node.spec,@"minWidth",180), MIN(node.preferredSplit, space));
      node.lastWidth = target;
      [current setPosition:target ofDividerAtIndex:0]; [node.splitController.view layoutSubtreeIfNeeded];
      node.applying = NO;
      CGFloat updated = current.arrangedSubviews.firstObject.frame.size.width;
      // The controller need not issue another viewDidLayout after a successful move.
      if (fabs(updated - target) <= 0.5) { node.reconcileAttempt = 0; node.reconcileRetries = 0; }
      else if (updated < target - 0.5 && space >= target && node.reconcileRetries < 3) {
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 30 * NSEC_PER_MSEC), dispatch_get_main_queue(), ^{
          TRNode *retry = weakSelf; if (!retry || retry.host.disposed) return;
          [retry reconcileWindowSplit];
        });
      }
    });
  }
}
@end
