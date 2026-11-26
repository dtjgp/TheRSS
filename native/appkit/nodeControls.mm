#import "nodeInternal.h"
#include <cmath>

CGFloat TRLuminance(NSColor *color) {
  NSColor *rgb = [color colorUsingColorSpace:NSColorSpace.sRGBColorSpace];
  auto linear = [](CGFloat channel) { return channel <= 0.04045 ? channel/12.92 : std::pow((channel+0.055)/1.055,2.4); };
  return 0.2126*linear(rgb.redComponent)+0.7152*linear(rgb.greenComponent)+0.0722*linear(rgb.blueComponent);
}
NSColor *TRPrimaryBackground(NSColor *accent) {
  // AppKit's colored bezel draws its title white even when contentTintColor is
  // black. Preserve the system hue but darken bright accents enough for that
  // actual native foreground, with a margin for bezel compositing.
  NSColor *color = accent;
  for (CGFloat amount = 0.18; amount <= 0.9; amount += 0.06) {
    color = [accent blendedColorWithFraction:amount ofColor:NSColor.blackColor];
    if (TRLuminance(color) <= 0.14) break;
  }
  return color;
}
CGFloat TRContrast(NSColor *first, NSColor *second) {
  CGFloat a = TRLuminance(first), b = TRLuminance(second);
  return (MAX(a,b)+0.05)/(MIN(a,b)+0.05);
}
NSColor *TRChartColor(NSColor *accent) {
  NSColor *background = NSColor.textBackgroundColor;
  if (TRContrast(accent,background) >= 3.2) return accent;
  NSColor *target = TRLuminance(background) < 0.179 ? NSColor.whiteColor : NSColor.blackColor;
  for (CGFloat amount = 0.06; amount < 1; amount += 0.06) {
    NSColor *candidate = [accent blendedColorWithFraction:amount ofColor:target];
    if (TRContrast(candidate,background) >= 3.2) return candidate;
  }
  return target;
}

@implementation TRLabel
- (BOOL)allowsVibrancy { return NO; }
@end

@implementation TRButtonCell
- (void)drawInteriorWithFrame:(NSRect)frame inView:(NSView *)view {
  [super drawInteriorWithFrame:NSInsetRect(frame,self.leadingInset,0) inView:view];
}
@end

@implementation TRButton
+ (Class)cellClass { return TRButtonCell.class; }
- (BOOL)allowsVibrancy { return NO; }
- (void)drawRect:(NSRect)rect {
  if ([self.emphasis isEqual:@"navigation"] && self.state == NSControlStateValueOn) {
    [[self.accent colorWithAlphaComponent:0.14] setFill];
    NSBezierPath *path = [NSBezierPath bezierPathWithRoundedRect:NSInsetRect(self.bounds,1,1) xRadius:8 yRadius:8]; [path fill];
    if (self.highContrast) { [NSColor.labelColor setStroke]; path.lineWidth = 1.5; [path stroke]; }
  }
  [super drawRect:rect];
}
@end

// Saved marker: a darker saved accent in light mode, system yellow in dark mode; both keep at least
// 3:1 against the list and the unfocused selection backgrounds. Increase Contrast uses the label colour.
NSColor *TRSavedColor(BOOL highContrast) {
  if (highContrast) return NSColor.labelColor;
  return [NSColor colorWithName:@"TRSaved" dynamicProvider:^NSColor *(NSAppearance *appearance) {
    BOOL dark = [[appearance bestMatchFromAppearancesWithNames:@[NSAppearanceNameAqua,NSAppearanceNameDarkAqua]] isEqual:NSAppearanceNameDarkAqua];
    return dark ? NSColor.systemYellowColor : [NSColor colorWithSRGBRed:0xa8/255.0 green:0x6f/255.0 blue:0 alpha:1];
  }];
}

@implementation TRResearchCell
- (void)layout {
  [super layout];
  CGFloat zoom = self.zoom, inset = 12*zoom, glyph = 16*zoom, gap = 8*zoom;
  CGFloat leading = self.kindView ? inset + glyph + gap : inset;
  CGFloat trailing = self.savedView.hidden || !self.savedView ? inset : inset + glyph + 6*zoom;
  CGFloat width = MAX(20,self.bounds.size.width-leading-trailing);
  self.textField.preferredMaxLayoutWidth = width;
  // The subtitle sits under the title's measured lines (one or two), and the block is centred in
  // the fixed-height row, so a one-line title does not leave its subtitle nearer the next row.
  // Measure through the cell at the final width: its insets decide whether the title wraps.
  CGFloat titleHeight = MIN(35*zoom,ceil([self.textField.cell cellSizeForBounds:NSMakeRect(0,0,width,CGFLOAT_MAX)].height));
  BOOL detail = self.detailField.stringValue.length > 0;
  CGFloat detailHeight = detail ? 16*zoom : 0, spacing = detail ? 4*zoom : 0;
  CGFloat bottom = floor((self.bounds.size.height-titleHeight-spacing-detailHeight)/2);
  self.detailField.frame = NSMakeRect(leading,bottom,MAX(20,self.bounds.size.width-leading-inset),detailHeight);
  self.textField.frame = NSMakeRect(leading,bottom+detailHeight+spacing,width,titleHeight);
  // Glyphs sit on the first title line, as in Mail and Finder lists.
  CGFloat top = NSMaxY(self.textField.frame) - glyph;
  self.kindView.frame = NSMakeRect(inset,top,glyph,glyph);
  self.savedView.frame = NSMakeRect(self.bounds.size.width-inset-glyph,top,glyph,glyph);
}
- (void)setBackgroundStyle:(NSBackgroundStyle)style {
  [super setBackgroundStyle:style];
  // A selected row in a focused list is drawn on the accent colour; glyphs follow the text.
  BOOL emphasized = style == NSBackgroundStyleEmphasized;
  self.kindView.contentTintColor = emphasized ? NSColor.alternateSelectedControlTextColor : self.highContrast ? NSColor.labelColor : NSColor.secondaryLabelColor;
  self.savedView.contentTintColor = emphasized ? NSColor.alternateSelectedControlTextColor : TRSavedColor(self.highContrast);
}
@end

@implementation TRDataCell
- (void)layout {
  [super layout];
  self.textField.frame = NSInsetRect(self.bounds,6*self.zoom,3*self.zoom);
}
@end

@implementation TRTable
- (void)mouseDown:(NSEvent *)event {
  // A drag to another app runs inside mouseDown; finishing it must not also open the row.
  self.dragged = NO; [super mouseDown:event];
  if (!self.dragged) [self.node activateRow];
}
- (void)keyDown:(NSEvent *)event {
  if (event.keyCode == 36 || event.keyCode == 76) { [self.node activateRow]; return; }
  [super keyDown:event];
}
- (void)rightMouseDown:(NSEvent *)event {
  NSInteger row = [self rowAtPoint:[self convertPoint:event.locationInWindow fromView:nil]];
  if (row >= 0) { [self selectRowIndexes:[NSIndexSet indexSetWithIndex:row] byExtendingSelection:NO]; [self.node contextRow]; }
}
@end

@implementation TRSplit
- (BOOL)acceptsFirstResponder { return !self.node.spec[@"compactPane"]; }
- (CGFloat)dividerThickness { return self.node.spec[@"compactPane"] ? 0 : [super dividerThickness]; }
- (void)mouseDown:(NSEvent *)event {
  // NSSplitView tracks a divider drag inside mouseDown; mark it as a user resize.
  self.node.userResizing = YES; [super mouseDown:event]; self.node.userResizing = NO;
}
- (BOOL)becomeFirstResponder { self.initialPosition = self.vertical ? self.arrangedSubviews.firstObject.frame.size.width : self.arrangedSubviews.firstObject.frame.size.height; return YES; }
- (void)keyDown:(NSEvent *)event {
  // Only a focused divider handles arrow keys. Keys a focused descendant ignores travel up the
  // responder chain; an outer split must not treat them as divider moves (and save a width).
  if (self.node.spec[@"compactPane"] || self.window.firstResponder != self) { [super keyDown:event]; return; }
  CGFloat position = self.vertical ? self.arrangedSubviews.firstObject.frame.size.width : self.arrangedSubviews.firstObject.frame.size.height;
  CGFloat step = (event.modifierFlags & NSEventModifierFlagShift) ? 32 : 8;
  CGFloat minimum = [self.node splitView:self constrainMinCoordinate:0 ofSubviewAt:0];
  CGFloat maximum = [self.node splitView:self constrainMaxCoordinate:0 ofSubviewAt:0];
  if (self.vertical && (event.keyCode == 123 || event.keyCode == 124)) position += event.keyCode == 123 ? -step : step;
  else if (!self.vertical && (event.keyCode == 125 || event.keyCode == 126)) position += event.keyCode == 126 ? -step : step;
  else if (event.keyCode == 115) position = minimum;
  else if (event.keyCode == 119) position = maximum;
  else if (event.keyCode == 53) position = self.initialPosition;
  else { [super keyDown:event]; return; }
  position = MIN(MAX(position,minimum),maximum);
  self.node.userResizing = YES; [self setPosition:position ofDividerAtIndex:0]; [self layoutSubtreeIfNeeded]; self.node.userResizing = NO;
}
@end

@implementation TRWindowSplitController
- (void)viewDidLayout { [super viewDidLayout]; [self.node reconcileWindowSplit]; }
- (void)splitViewDidResizeSubviews:(NSNotification *)notification {
  if (self.node.animatingSplit) {
    NSView *pane = self.splitView.arrangedSubviews.firstObject;
    [self.node.animationWidths addObject:@(round(pane.isHidden ? 0 : pane.frame.size.width))];
  }
  if ([NSSplitViewController instancesRespondToSelector:@selector(splitViewDidResizeSubviews:)]) [super splitViewDidResizeSubviews:notification];
  [self.node splitViewDidResizeSubviews:notification];
  for (NSSplitViewItem *item in self.splitViewItems) item.viewController.view.needsLayout = YES;
}
@end

@implementation TRCanvas
- (BOOL)isFlipped { return YES; }
- (void)drawRect:(NSRect)rect { if (self.paintsBackground) { [NSColor.windowBackgroundColor setFill]; NSRectFill(rect); } }
@end

/** The system point size of a macOS text style (Body when unknown). */
CGFloat TRTextStyleSize(NSString *style) {
  // Layout asks for fonts often; the system sizes are fixed per process, so look them up once.
  static NSDictionary<NSString *, NSNumber *> *sizes;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    NSDictionary<NSString *, NSFontTextStyle> *styles = @{@"title1":NSFontTextStyleTitle1,@"title2":NSFontTextStyleTitle2,@"title3":NSFontTextStyleTitle3,
      @"headline":NSFontTextStyleHeadline,@"body":NSFontTextStyleBody,@"callout":NSFontTextStyleCallout,@"subheadline":NSFontTextStyleSubheadline,@"footnote":NSFontTextStyleFootnote};
    NSMutableDictionary *measured = [NSMutableDictionary dictionary];
    for (NSString *name in styles) measured[name] = @([NSFont preferredFontForTextStyle:styles[name] options:@{}].pointSize);
    sizes = measured;
  });
  return (sizes[style] ?: sizes[@"body"]).doubleValue;
}
NSString *TRString(id value) { return [value isKindOfClass:NSString.class] ? value : @""; }
CGFloat TRNumber(NSDictionary *spec, NSString *key, CGFloat fallback) { return spec[key] ? [spec[key] doubleValue] : fallback; }
