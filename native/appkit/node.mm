#import "ui.h"
#include <cmath>

static CGFloat TRLuminance(NSColor *color) {
  NSColor *rgb = [color colorUsingColorSpace:NSColorSpace.sRGBColorSpace];
  auto linear = [](CGFloat channel) { return channel <= 0.04045 ? channel/12.92 : std::pow((channel+0.055)/1.055,2.4); };
  return 0.2126*linear(rgb.redComponent)+0.7152*linear(rgb.greenComponent)+0.0722*linear(rgb.blueComponent);
}
static NSColor *TRPrimaryBackground(NSColor *accent) {
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
static CGFloat TRContrast(NSColor *first, NSColor *second) {
  CGFloat a = TRLuminance(first), b = TRLuminance(second);
  return (MAX(a,b)+0.05)/(MIN(a,b)+0.05);
}
static NSColor *TRChartColor(NSColor *accent) {
  NSColor *background = NSColor.textBackgroundColor;
  if (TRContrast(accent,background) >= 3.2) return accent;
  NSColor *target = TRLuminance(background) < 0.179 ? NSColor.whiteColor : NSColor.blackColor;
  for (CGFloat amount = 0.06; amount < 1; amount += 0.06) {
    NSColor *candidate = [accent blendedColorWithFraction:amount ofColor:target];
    if (TRContrast(candidate,background) >= 3.2) return candidate;
  }
  return target;
}

@interface TRLabel : NSTextField @end
@implementation TRLabel
- (BOOL)allowsVibrancy { return NO; }
@end
@interface TRButtonCell : NSButtonCell
@property(nonatomic) CGFloat leadingInset;
@end
@implementation TRButtonCell
- (void)drawInteriorWithFrame:(NSRect)frame inView:(NSView *)view {
  [super drawInteriorWithFrame:NSInsetRect(frame,self.leadingInset,0) inView:view];
}
@end
@interface TRButton : NSButton
@property(nonatomic, copy) NSString *emphasis;
@property(nonatomic, strong) NSColor *accent;
@property(nonatomic) BOOL highContrast;
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

@interface TRResearchCell : NSTableCellView
@property(nonatomic, strong) NSTextField *detailField;
@property(nonatomic) CGFloat zoom;
@end
@implementation TRResearchCell
- (void)layout {
  [super layout];
  CGFloat inset = 12*self.zoom, width = MAX(20,self.bounds.size.width-2*inset);
  self.textField.frame = NSMakeRect(inset,27*self.zoom,width,35*self.zoom);
  self.textField.preferredMaxLayoutWidth = width;
  self.detailField.frame = NSMakeRect(inset,7*self.zoom,width,16*self.zoom);
}
@end

@interface TRTable : NSTableView
@property(nonatomic, weak) TRNode *node;
@end
@implementation TRTable
- (void)mouseDown:(NSEvent *)event { [super mouseDown:event]; [self.node activateRow]; }
- (void)keyDown:(NSEvent *)event {
  if (event.keyCode == 36 || event.keyCode == 76) { [self.node activateRow]; return; }
  [super keyDown:event];
}
- (void)rightMouseDown:(NSEvent *)event {
  NSInteger row = [self rowAtPoint:[self convertPoint:event.locationInWindow fromView:nil]];
  if (row >= 0) { [self selectRowIndexes:[NSIndexSet indexSetWithIndex:row] byExtendingSelection:NO]; [self.node contextRow]; }
}
@end

@interface TRSplit : NSSplitView
@property(nonatomic, weak) TRNode *node;
@property(nonatomic) CGFloat initialPosition;
@end
@implementation TRSplit
- (BOOL)acceptsFirstResponder { return YES; }
- (BOOL)becomeFirstResponder { self.initialPosition = self.vertical ? self.subviews.firstObject.frame.size.width : self.subviews.firstObject.frame.size.height; return YES; }
- (void)keyDown:(NSEvent *)event {
  CGFloat position = self.vertical ? self.subviews.firstObject.frame.size.width : self.subviews.firstObject.frame.size.height;
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
  [self setPosition:position ofDividerAtIndex:0];
}
@end

@implementation TRCanvas
- (BOOL)isFlipped { return YES; }
- (void)drawRect:(NSRect)rect { if (self.paintsBackground) { [NSColor.windowBackgroundColor setFill]; NSRectFill(rect); } }
@end

static NSString *TRString(id value) { return [value isKindOfClass:NSString.class] ? value : @""; }
static CGFloat TRNumber(NSDictionary *spec, NSString *key, CGFloat fallback) { return spec[key] ? [spec[key] doubleValue] : fallback; }

@implementation TRNode
- (void)drawRect:(NSRect)rect {
  [super drawRect:rect];
  NSString *surface = self.spec[@"surface"];
  if (!surface) return;
  NSColor *fill = [surface isEqual:@"inset"] ? NSColor.controlBackgroundColor : NSColor.textBackgroundColor;
  [fill setFill];
  NSBezierPath *path = [NSBezierPath bezierPathWithRoundedRect:NSInsetRect(self.bounds,0.5,0.5) xRadius:10 yRadius:10];
  [path fill];
  if (![surface isEqual:@"reading"]) {
    [(self.host.increaseContrast ? NSColor.labelColor : NSColor.separatorColor) setStroke];
    path.lineWidth = self.host.increaseContrast ? 1.5 : 0.5; [path stroke];
  }
}
- (void)updateMaterial {
  if (![self.spec[@"glass"] boolValue]) return;
  BOOL opaque = [self.host reduceTransparency];
  if (self.control && opaque != [self.control isKindOfClass:NSGlassEffectView.class]) return;
  [self.container removeFromSuperview]; [self.control removeFromSuperview];
  if (!self.container) self.container = [TRCanvas new];
  if (opaque) {
    TRCanvas *background = [TRCanvas new]; background.paintsBackground = YES;
    self.control = background;
  } else {
    NSGlassEffectView *glass = [NSGlassEffectView new]; glass.contentView = [TRCanvas new]; self.control = glass;
  }
  self.control.frame = self.bounds; self.control.appearance = self.host.canvas.effectiveAppearance;
  // Keep the all-AppKit foreground in the same native layout node, above the
  // material view. Glass's adaptive content compositing can otherwise reduce
  // ordinary enabled text to ~1.6:1 contrast after dark-appearance transitions.
  [self addSubview:self.control]; [self addSubview:self.container]; self.needsLayout = YES;
}
- (void)updateControlAppearance {
  if (!self.control || !self.spec) return;
  NSDictionary *spec = self.spec;
  [self.host.canvas.effectiveAppearance performAsCurrentDrawingAppearance:^{
    if ([spec[@"kind"] isEqual:@"chart"]) {
      TRChart *chart = (TRChart *)self.control;
      chart.accent = TRChartColor(self.host.fixture && self.host.fixtureAccent ? self.host.fixtureAccent : NSColor.controlAccentColor);
      chart.highContrast = self.host.increaseContrast;
      chart.needsDisplay = YES;
    }
    if ([spec[@"kind"] isEqual:@"button"]) {
      TRButton *button = (TRButton *)self.control;
      button.emphasis = spec[@"emphasis"];
      BOOL navigation = [button.emphasis isEqual:@"navigation"], quiet = [button.emphasis isEqual:@"quiet"], primary = [button.emphasis isEqual:@"primary"];
      button.bordered = !navigation && !quiet;
      button.alignment = navigation ? NSTextAlignmentLeft : NSTextAlignmentCenter;
      button.accent = self.host.fixture && self.host.fixtureAccent ? self.host.fixtureAccent : NSColor.controlAccentColor;
      button.highContrast = self.host.increaseContrast;
      button.bezelColor = primary ? TRPrimaryBackground(button.accent) : nil;
      button.contentTintColor = primary && button.enabled ? NSColor.whiteColor : navigation ? NSColor.labelColor : nil;
      ((TRButtonCell *)button.cell).leadingInset = navigation ? 8*self.host.zoom : 0;
      if (navigation) { ((NSButtonCell *)button.cell).highlightsBy = NSNoCellMask; ((NSButtonCell *)button.cell).showsStateBy = NSNoCellMask; }
      button.image = spec[@"symbol"] ? [NSImage imageWithSystemSymbolName:spec[@"symbol"] accessibilityDescription:nil] : nil;
      button.symbolConfiguration = [NSImageSymbolConfiguration configurationWithPointSize:14*self.host.zoom weight:NSFontWeightMedium];
      button.imagePosition = button.image ? NSImageLeading : NSNoImage;
      button.font = [NSFont systemFontOfSize:self.font.pointSize weight:navigation && [spec[@"checked"] boolValue] ? NSFontWeightSemibold : NSFontWeightRegular];
      button.needsDisplay = YES;
    }
  }];
}
- (void)viewDidChangeEffectiveAppearance {
  [super viewDidChangeEffectiveAppearance];
  // Glass supplies a vibrant inherited appearance even to non-vibrant controls.
  // Give text/buttons the window's ordinary appearance so semantic label colors
  // remain legible in dark mode and after an appearance transition.
  if (self.control) self.control.appearance = self.host.canvas.effectiveAppearance;
  if ([self.spec[@"kind"] isEqual:@"table"]) {
    NSTableView *table = (NSTableView *)((NSScrollView *)self.control).documentView;
    table.backgroundColor = NSColor.textBackgroundColor;
  }
  [self updateControlAppearance];
  self.needsDisplay = YES;
}
- (instancetype)initWithHost:(TRHost *)host spec:(NSDictionary *)spec {
  self = [super initWithFrame:NSZeroRect];
  if (self) { self.host = host; self.nodes = @[]; self.stackedFraction = 0.4; [self update:spec]; }
  return self;
}
- (NSFont *)font {
  CGFloat size = TRNumber(self.spec, @"size", [self.spec[@"weight"] isEqual:@"title"] ? 23 : 13) * self.host.zoom;
  return ([self.spec[@"weight"] isEqual:@"bold"] || [self.spec[@"weight"] isEqual:@"title"]) ? [NSFont boldSystemFontOfSize:size] : [NSFont systemFontOfSize:size];
}
- (void)createControl {
  NSString *kind = self.spec[@"kind"];
  if ([kind isEqual:@"column"] || [kind isEqual:@"row"]) {
    if ([self.spec[@"adaptiveScroll"] boolValue]) {
      NSScrollView *scroll = [NSScrollView new]; scroll.hasVerticalScroller = YES; scroll.drawsBackground = NO; scroll.autohidesScrollers = YES;
      self.container = [TRCanvas new]; scroll.documentView = self.container; self.control = scroll;
    } else [self updateMaterial];
  } else if ([kind isEqual:@"split"]) {
    TRSplit *split = [TRSplit new]; split.node = self; split.delegate = self; split.vertical = YES; split.dividerStyle = NSSplitViewDividerStyleThin;
    split.accessibilityLabel = self.spec[@"title"] ?: @"Resize panes with arrow keys";
    self.control = split;
  } else if ([kind isEqual:@"scroll"]) {
    NSScrollView *scroll = [NSScrollView new]; scroll.hasVerticalScroller = YES; scroll.drawsBackground = NO; scroll.autohidesScrollers = YES;
    self.container = [TRCanvas new]; scroll.documentView = self.container; self.control = scroll;
  } else if ([kind isEqual:@"label"]) {
    NSTextField *label = [TRLabel wrappingLabelWithString:@""]; label.selectable = YES; self.control = label;
  } else if ([kind isEqual:@"chart"]) {
    TRChart *chart = [TRChart new]; chart.accessibilityElement = YES; chart.accessibilityRole = NSAccessibilityImageRole; self.control = chart;
  } else if ([kind isEqual:@"text"]) {
    NSTextView *text = [[NSTextView alloc] initWithFrame:NSMakeRect(0,0,500,100)];
    text.editable = NO; text.selectable = YES; text.drawsBackground = NO; text.delegate = self;
    text.textContainerInset = NSMakeSize(0, 4); text.textContainer.lineFragmentPadding = 0;
    text.textContainer.widthTracksTextView = YES; text.verticallyResizable = YES; text.horizontallyResizable = NO;
    text.automaticLinkDetectionEnabled = NO; self.control = text;
  } else if ([kind isEqual:@"input"] && [self.spec[@"multiline"] boolValue]) {
    NSScrollView *scroll = [NSScrollView new]; scroll.hasVerticalScroller = YES; scroll.autohidesScrollers = YES; scroll.borderType = NSBezelBorder;
    NSTextView *input = [[NSTextView alloc] initWithFrame:NSMakeRect(0,0,500,100)]; input.delegate = self; input.richText = NO;
    input.allowsUndo = YES; input.textContainerInset = NSMakeSize(8, 8); input.textContainer.widthTracksTextView = YES;
    input.autoresizingMask = NSViewWidthSizable; input.verticallyResizable = YES; input.horizontallyResizable = NO;
    input.automaticQuoteSubstitutionEnabled = NO; input.automaticDashSubstitutionEnabled = NO;
    scroll.documentView = input; self.control = scroll;
  } else if ([kind isEqual:@"input"] || [kind isEqual:@"secure"]) {
    NSTextField *input = [kind isEqual:@"secure"] ? [NSSecureTextField new] : [NSTextField new];
    input.delegate = self; input.target = self; input.action = @selector(trigger:); self.control = input;
  } else if ([kind isEqual:@"button"] || [kind isEqual:@"check"]) {
    NSButton *button = [TRButton buttonWithTitle:@"" target:self action:@selector(trigger:)];
    if ([kind isEqual:@"check"]) [button setButtonType:NSButtonTypeSwitch];
    else button.bezelStyle = NSBezelStyleRounded;
    self.control = button;
  } else if ([kind isEqual:@"select"]) {
    NSPopUpButton *select = [[NSPopUpButton alloc] initWithFrame:NSZeroRect pullsDown:NO]; select.target = self; select.action = @selector(trigger:); self.control = select;
  } else if ([kind isEqual:@"table"]) {
    NSScrollView *scroll = [NSScrollView new]; scroll.hasVerticalScroller = YES; scroll.autohidesScrollers = YES; scroll.drawsBackground = NO;
    TRTable *table = [TRTable new]; table.node = self; table.delegate = self; table.dataSource = self;
    table.headerView = nil; table.rowHeight = 70 * self.host.zoom; table.intercellSpacing = NSMakeSize(0, 2);
    table.style = NSTableViewStyleInset; table.backgroundColor = NSColor.textBackgroundColor;
    NSTableColumn *column = [[NSTableColumn alloc] initWithIdentifier:@"item"]; [table addTableColumn:column];
    table.columnAutoresizingStyle = NSTableViewLastColumnOnlyAutoresizingStyle;
    table.allowsEmptySelection = YES; scroll.documentView = table; self.control = scroll;
  }
  if (self.control && self.control.superview != self) [self addSubview:self.control];
}
- (void)update:(NSDictionary *)spec {
  NSDictionary *old = self.spec; self.spec = spec; self.applying = YES;
  NSString *kind = spec[@"kind"];
  if ([kind isEqual:@"split"] && (!old || ![old[@"width"] isEqual:spec[@"width"]])) self.preferredSplit = TRNumber(spec,@"width",320);
  if (!old) [self createControl];
  self.control.appearance = self.host.canvas.effectiveAppearance;
  self.identifier = spec[@"id"];
  self.control.identifier = self.identifier;
  self.control.accessibilityLabel = spec[@"title"] ?: spec[@"placeholder"] ?: ([kind isEqual:@"text"] ? @"Research content" : nil);
  if ([self.control isKindOfClass:NSControl.class]) {
    NSControl *control = (NSControl *)self.control; control.enabled = spec[@"enabled"] ? [spec[@"enabled"] boolValue] : YES; control.font = self.font;
  }
  if ([kind isEqual:@"label"]) {
    NSTextField *label = (NSTextField *)self.control; label.stringValue = TRString(spec[@"text"] ?: spec[@"title"]);
    label.maximumNumberOfLines = [spec[@"maxLines"] integerValue];
    label.lineBreakMode = spec[@"maxLines"] ? NSLineBreakByTruncatingTail : NSLineBreakByWordWrapping;
    label.toolTip = spec[@"maxLines"] ? label.stringValue : nil;
    label.textColor = [spec[@"weight"] isEqual:@"secondary"] && ![self.host increaseContrast] ? NSColor.secondaryLabelColor : NSColor.labelColor;
  } else if ([kind isEqual:@"chart"]) {
    TRChart *chart = (TRChart *)self.control;
    chart.points = spec[@"points"] ?: @[]; chart.zoom = self.host.zoom; chart.highContrast = self.host.increaseContrast;
    NSMutableArray *values = [NSMutableArray array];
    for (NSDictionary *point in chart.points) [values addObject:[NSString stringWithFormat:@"%@: %@ %@",point[@"date"],point[@"value"],TRString(spec[@"text"])]];
    chart.accessibilityValue = [values componentsJoinedByString:@"; "]; chart.toolTip = chart.accessibilityValue; chart.needsDisplay = YES;
  } else if ([kind isEqual:@"text"]) {
    NSTextView *text = (NSTextView *)self.control;
    if (![old[@"text"] isEqual:spec[@"text"]] || text.font.pointSize != self.font.pointSize) {
      NSRange selection = text.selectedRange;
      NSAttributedString *content = TRResearchText(TRString(spec[@"text"]),self.font);
      [text.textStorage setAttributedString:content];
      if (NSMaxRange(selection) <= content.length) text.selectedRange = selection;
    }
  } else if ([kind isEqual:@"input"] || [kind isEqual:@"secure"]) {
    BOOL force = !old || ![old[@"clearRevision"] ?: @0 isEqual:spec[@"clearRevision"] ?: @0];
    if ([self.control isKindOfClass:NSScrollView.class]) {
      NSTextView *input = (NSTextView *)((NSScrollView *)self.control).documentView;
      input.font = self.font; input.editable = spec[@"enabled"] ? [spec[@"enabled"] boolValue] : YES;
      input.accessibilityLabel = spec[@"title"];
      if (force || self.window.firstResponder != input) {
        NSString *value = TRString(spec[@"value"]);
        if (![input.string isEqual:value]) { input.string = value; if (force) [input.undoManager removeAllActions]; }
      }
    } else {
      NSTextField *input = (NSTextField *)self.control; input.placeholderString = spec[@"placeholder"];
      BOOL editing = input.currentEditor && self.window.firstResponder == input.currentEditor;
      if ([kind isEqual:@"secure"]) { if (force) input.stringValue = @""; }
      else if (force || !editing) { NSString *value = TRString(spec[@"value"]); if (![input.stringValue isEqual:value]) input.stringValue = value; }
    }
  } else if ([kind isEqual:@"button"] || [kind isEqual:@"check"]) {
    TRButton *button = (TRButton *)self.control; button.title = TRString(spec[@"title"]);
    if ([kind isEqual:@"button"] && spec[@"checked"]) [button setButtonType:NSButtonTypePushOnPushOff];
    button.state = [spec[@"checked"] boolValue] ? NSControlStateValueOn : NSControlStateValueOff;
    button.needsDisplay = YES;
  } else if ([kind isEqual:@"select"]) {
    NSPopUpButton *select = (NSPopUpButton *)self.control;
    if (![old[@"options"] isEqual:spec[@"options"]]) {
      [select removeAllItems];
      for (NSDictionary *option in spec[@"options"]) { [select addItemWithTitle:option[@"title"]]; select.lastItem.representedObject = option[@"id"]; select.lastItem.enabled = option[@"enabled"] ? [option[@"enabled"] boolValue] : YES; }
      select.autoenablesItems = NO;
    }
    for (NSMenuItem *item in select.itemArray) if ([item.representedObject isEqual:spec[@"selected"]]) [select selectItem:item];
  } else if ([kind isEqual:@"table"]) {
    NSTableView *table = (NSTableView *)((NSScrollView *)self.control).documentView;
    BOOL fontChanged = table.rowHeight != 70 * self.host.zoom;
    table.rowHeight = 70 * self.host.zoom;
    table.backgroundColor = NSColor.textBackgroundColor;
    NSPoint origin = ((NSScrollView *)self.control).contentView.bounds.origin;
    if (fontChanged || ![old[@"rows"] isEqual:spec[@"rows"]]) [table reloadData];
    NSInteger selected = -1, row = 0;
    for (NSDictionary *item in spec[@"rows"]) { if ([item[@"id"] isEqual:spec[@"selected"]]) selected = row; row++; }
    if (selected < 0) [table deselectAll:nil];
    else if (table.selectedRow != selected) [table selectRowIndexes:[NSIndexSet indexSetWithIndex:selected] byExtendingSelection:NO];
    [((NSScrollView *)self.control).contentView scrollToPoint:origin];
  }
  NSMutableDictionary *existing = [NSMutableDictionary dictionary];
  for (TRNode *node in self.nodes) existing[node.identifier] = node;
  NSMutableArray *children = [NSMutableArray array];
  NSView *parent = [kind isEqual:@"split"] ? self.control : self.container ?: self;
  for (NSDictionary *child in spec[@"children"]) {
    TRNode *node = existing[child[@"id"]];
    if (!node && [child[@"kind"] isEqual:@"secure"]) node = self.host.secureFields[child[@"id"]];
    if (node && ![node.spec[@"kind"] isEqual:child[@"kind"]]) { [node removeFromSuperview]; node = nil; }
    if (node) [node update:child]; else node = [[TRNode alloc] initWithHost:self.host spec:child];
    if ([child[@"kind"] isEqual:@"secure"]) self.host.secureFields[child[@"id"]] = node;
    [existing removeObjectForKey:child[@"id"]]; [children addObject:node];
    if (node.superview != parent) [parent addSubview:node];
  }
  for (TRNode *node in existing.allValues) [node removeFromSuperview];
  self.nodes = children;
  if ([kind isEqual:@"scroll"] && old && (![old[@"clearRevision"] ?: @0 isEqual:spec[@"clearRevision"] ?: @0] || ![[old[@"children"] firstObject][@"id"] isEqual:[spec[@"children"] firstObject][@"id"]])) {
    self.resetScrollAfterLayout = YES;
  }
  if ([spec[@"adaptiveScroll"] boolValue] && old && ![[old[@"children"] lastObject][@"id"] isEqual:[spec[@"children"] lastObject][@"id"]]) self.resetScrollAfterLayout = YES;
  [self updateControlAppearance];
  self.applying = NO; self.needsLayout = YES;
}
- (CGFloat)preferredWidth {
  if (self.spec[@"width"]) return [self.spec[@"width"] doubleValue] * self.host.zoom;
  if ([self.control isKindOfClass:NSControl.class]) return MAX(60, self.control.intrinsicContentSize.width + 8);
  return 180 * self.host.zoom;
}
- (BOOL)wrapsRowAtWidth:(CGFloat)width {
  CGFloat padding = TRNumber(self.spec,@"padding",0) * self.host.zoom, gap = TRNumber(self.spec,@"gap",10) * self.host.zoom;
  CGFloat fixed = MAX(0,(NSInteger)self.nodes.count-1)*gap;
  for (TRNode *child in self.nodes) fixed += [child.spec[@"flex"] doubleValue] > 0 ? MIN(180*self.host.zoom,child.preferredWidth) : child.preferredWidth;
  return fixed > width - 2*padding;
}
- (CGFloat)wrappedRowAtWidth:(CGFloat)width apply:(BOOL)apply {
  CGFloat padding = TRNumber(self.spec,@"padding",0) * self.host.zoom, gap = TRNumber(self.spec,@"gap",10) * self.host.zoom;
  CGFloat x = padding, y = padding, lineHeight = 0, available = MAX(20,width-2*padding);
  for (TRNode *child in self.nodes) {
    CGFloat childWidth = MIN(available,child.preferredWidth), childHeight = [child heightForWidth:childWidth];
    if (x > padding && x+childWidth > width-padding) { x = padding; y += lineHeight+gap; lineHeight = 0; }
    if (apply) child.frame = NSMakeRect(x,y,childWidth,childHeight);
    x += childWidth+gap; lineHeight = MAX(lineHeight,childHeight);
  }
  return y+lineHeight+padding;
}
- (CGFloat)heightForWidth:(CGFloat)width {
  CGFloat zoom = self.host.zoom, padding = TRNumber(self.spec, @"padding", 0) * zoom, gap = TRNumber(self.spec,@"gap",10) * zoom;
  if (self.spec[@"height"]) return [self.spec[@"height"] doubleValue] * zoom;
  NSString *kind = self.spec[@"kind"];
  if ([kind isEqual:@"column"]) {
    CGFloat height = 2 * padding + MAX(0, (NSInteger)self.nodes.count - 1) * gap;
    for (TRNode *child in self.nodes) height += [child heightForWidth:MAX(20,width-2*padding)];
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
    text.textContainer.containerSize = NSMakeSize(MAX(20,width),CGFLOAT_MAX);
    [text.layoutManager ensureLayoutForTextContainer:text.textContainer];
    NSRect rect = [text.layoutManager usedRectForTextContainer:text.textContainer];
    return ceil(rect.size.height) + 2*text.textContainerInset.height;
  }
  if ([kind isEqual:@"split"]) return TRNumber(self.spec,@"minHeight",self.spec[@"collapseAt"] && width < [self.spec[@"collapseAt"] doubleValue] ? 340 : 200) * zoom;
  if ([kind isEqual:@"scroll"] || [kind isEqual:@"table"]) return TRNumber(self.spec,@"minHeight",200) * zoom;
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
  if ([self.spec[@"adaptiveScroll"] boolValue]) {
    NSScrollView *scroll = (NSScrollView *)self.control;
    width = scroll.contentSize.width; height = MAX(scroll.contentSize.height,[self heightForWidth:width]);
  }
  CGFloat padding = TRNumber(self.spec,@"padding",0) * self.host.zoom, gap = TRNumber(self.spec,@"gap",10) * self.host.zoom;
  if ([kind isEqual:@"scroll"]) {
    NSScrollView *scroll = (NSScrollView *)self.control;
    CGFloat contentWidth = scroll.contentSize.width, y = 0;
    for (TRNode *child in self.nodes) {
      CGFloat childWidth = MIN(contentWidth,TRNumber(child.spec,@"maxWidth",contentWidth/self.host.zoom)*self.host.zoom);
      CGFloat h = [child heightForWidth:childWidth]; child.frame = NSMakeRect(0,y,childWidth,h); y += h;
    }
    self.container.frame = NSMakeRect(0,0,contentWidth,MAX(y,scroll.contentSize.height));
  } else if ([kind isEqual:@"split"] && self.nodes.count == 2) {
    NSSplitView *split = (NSSplitView *)self.control;
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
    for (TRNode *child in self.nodes) { if ([child.spec[@"flex"] doubleValue] > 0) flex += [child.spec[@"flex"] doubleValue]; else total += row ? child.preferredWidth : [child heightForWidth:MAX(20,width-2*padding)]; }
    CGFloat available = MAX(0, (row ? width : height) - 2*padding - total), position = padding;
    for (TRNode *child in self.nodes) {
      CGFloat extent = [child.spec[@"flex"] doubleValue] > 0 && flex ? available * [child.spec[@"flex"] doubleValue] / flex : (row ? child.preferredWidth : [child heightForWidth:MAX(20,width-2*padding)]);
      CGFloat childWidth = MAX(0,width-2*padding);
      if (!row && ![child.spec[@"kind"] isEqual:@"split"]) {
        if (child.spec[@"width"]) childWidth = MIN(childWidth,[child.spec[@"width"] doubleValue]*self.host.zoom);
        if (child.spec[@"maxWidth"]) childWidth = MIN(childWidth,[child.spec[@"maxWidth"] doubleValue]*self.host.zoom);
      }
      child.frame = row ? NSMakeRect(position,padding,extent,MAX(0,height-2*padding)) : NSMakeRect(padding,position,childWidth,extent);
      position += extent + gap;
    }
  } else if ([kind isEqual:@"table"]) {
    NSTableView *table = (NSTableView *)((NSScrollView *)self.control).documentView;
    table.tableColumns.firstObject.width = MAX(60, ((NSScrollView *)self.control).contentSize.width);
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
- (NSInteger)numberOfRowsInTableView:(NSTableView *)table { return [self.spec[@"rows"] count]; }
- (NSView *)tableView:(NSTableView *)table viewForTableColumn:(NSTableColumn *)column row:(NSInteger)row {
  NSArray *rows = self.spec[@"rows"]; if (row < 0 || row >= (NSInteger)rows.count) return nil;
  NSDictionary *item = rows[row];
  TRResearchCell *cell = [TRResearchCell new]; cell.zoom = self.host.zoom;
  NSTextField *label = [NSTextField wrappingLabelWithString:item[@"title"]];
  label.font = [NSFont systemFontOfSize:self.font.pointSize weight:NSFontWeightMedium]; label.maximumNumberOfLines = 2; label.lineBreakMode = NSLineBreakByWordWrapping;
  label.cell.wraps = YES; label.cell.usesSingleLineMode = NO;
  label.preferredMaxLayoutWidth = MAX(30,column.width-24*self.host.zoom);
  [cell addSubview:label]; cell.textField = label;
  NSTextField *detail = [NSTextField labelWithString:TRString(item[@"subtitle"])]; detail.font = [NSFont systemFontOfSize:11*self.host.zoom]; detail.textColor = NSColor.secondaryLabelColor;
  detail.lineBreakMode = NSLineBreakByTruncatingTail;
  [cell addSubview:detail]; cell.detailField = detail; cell.toolTip = item[@"title"];
  cell.accessibilityLabel = [NSString stringWithFormat:@"%@. %@",item[@"title"],TRString(item[@"subtitle"])];
  return cell;
}
- (NSString *)selectedRowId {
  NSTableView *table = (NSTableView *)((NSScrollView *)self.control).documentView;
  NSArray *rows = self.spec[@"rows"]; return table.selectedRow >= 0 && table.selectedRow < (NSInteger)rows.count ? rows[table.selectedRow][@"id"] : nil;
}
- (void)tableViewSelectionDidChange:(NSNotification *)notification {
  if (!self.applying) [self.host emit:self.spec[@"action"] value:[self selectedRowId] secret:NO];
}
- (void)activateRow { [self.host emit:self.spec[@"activate"] value:[self selectedRowId] secret:NO]; }
- (void)contextRow { [self.host emit:self.spec[@"context"] value:[self selectedRowId] secret:NO]; }
- (void)trigger:(id)sender {
  if (self.applying) return;
  if ([self.control isKindOfClass:NSControl.class] && !((NSControl *)self.control).enabled) return;
  NSString *kind = self.spec[@"kind"];
  if ([kind isEqual:@"select"]) [self.host emit:self.spec[@"action"] value:((NSPopUpButton *)self.control).selectedItem.representedObject secret:NO];
  else if ([kind isEqual:@"check"]) [self.host emit:self.spec[@"action"] value:@(((NSButton *)self.control).state == NSControlStateValueOn) secret:NO];
  else if ([kind isEqual:@"input"] || [kind isEqual:@"secure"]) [self.host emit:self.spec[@"activate"] value:nil secret:NO];
  else [self.host emit:self.spec[@"action"] value:nil secret:NO];
}
- (void)controlTextDidChange:(NSNotification *)notification { [self editChanged]; }
- (void)textDidChange:(NSNotification *)notification { [self editChanged]; }
- (void)editChanged {
  if (self.applying) return;
  if ([self.control isKindOfClass:NSControl.class] && !((NSControl *)self.control).enabled) return;
  NSString *value; BOOL marked = NO;
  if ([self.control isKindOfClass:NSScrollView.class]) {
    NSTextView *text = (NSTextView *)((NSScrollView *)self.control).documentView;
    if (!text.editable) return;
    marked = text.hasMarkedText; value = text.string;
  } else {
    NSTextField *input = (NSTextField *)self.control;
    marked = [(NSTextView *)input.currentEditor hasMarkedText];
    value = marked ? input.currentEditor.string : input.stringValue;
  }
  NSUInteger maximum = self.spec[@"maxLength"] ? [self.spec[@"maxLength"] unsignedIntegerValue] : 20000;
  if (value.length > maximum) {
    if (!marked) NSBeep();
    NSRange lastCharacter = [value rangeOfComposedCharacterSequenceAtIndex:maximum - 1];
    NSUInteger end = NSMaxRange(lastCharacter) <= maximum ? maximum : lastCharacter.location;
    value = [value substringToIndex:end];
    // Report a bounded draft without mutating the IME's provisional text. Enforce
    // the native limit only when composition commits.
    if (!marked) {
      if ([self.control isKindOfClass:NSScrollView.class]) ((NSTextView *)((NSScrollView *)self.control).documentView).string = value;
      else ((NSTextField *)self.control).stringValue = value;
    }
  }
  [self.host emit:self.spec[@"action"] value:value secret:[self.spec[@"kind"] isEqual:@"secure"]];
}
- (BOOL)textView:(NSTextView *)textView clickedOnLink:(id)link atIndex:(NSUInteger)index {
  NSString *url = [link isKindOfClass:NSURL.class] ? [link absoluteString] : TRString(link);
  [self.host emit:self.spec[@"activate"] value:url secret:NO]; return YES;
}
- (CGFloat)splitView:(NSSplitView *)split constrainMinCoordinate:(CGFloat)proposed ofSubviewAt:(NSInteger)index { return split.vertical ? TRNumber(self.spec,@"minWidth",180) : 160; }
- (CGFloat)splitView:(NSSplitView *)split constrainMaxCoordinate:(CGFloat)proposed ofSubviewAt:(NSInteger)index { return split.vertical ? MAX(TRNumber(self.spec,@"minWidth",180),MIN(TRNumber(self.spec,@"maxWidth",520),split.bounds.size.width-TRNumber(self.spec,@"minContentWidth",200))) : split.bounds.size.height-160; }
- (void)splitViewDidResizeSubviews:(NSNotification *)notification {
  NSSplitView *split = (NSSplitView *)self.control;
  if (!self.applying && !split.vertical && self.window && split.bounds.size.height > 0) self.stackedFraction = split.subviews.firstObject.frame.size.height/split.bounds.size.height;
  if (!self.applying && split.vertical && self.lastWidth && self.window) {
    CGFloat value = split.subviews.firstObject.frame.size.width;
    if (value >= TRNumber(self.spec,@"minWidth",180) && value <= TRNumber(self.spec,@"maxWidth",520)) { self.preferredSplit = value; [self.host emit:self.spec[@"action"] value:@(value) secret:NO]; }
  }
}
- (TRNode *)find:(NSString *)identifier {
  if ([self.identifier isEqual:identifier]) return self;
  for (TRNode *child in self.nodes) { TRNode *found = [child find:identifier]; if (found) return found; }
  return nil;
}
- (NSDictionary *)inspect {
  NSMutableDictionary *result = [@{@"id":self.identifier ?: @"", @"kind":self.spec[@"kind"], @"class":self.control ? NSStringFromClass(self.control.class) : NSStringFromClass(self.class), @"frame":NSStringFromRect(self.frame), @"label":self.control.accessibilityLabel ?: @""} mutableCopy];
  result[@"appearance"] = self.effectiveAppearance.name;
  if (self.control) result[@"controlAppearance"] = self.control.effectiveAppearance.name;
  if (self.spec[@"surface"]) result[@"surface"] = self.spec[@"surface"];
  if ([self.control isKindOfClass:TRButton.class]) {
    result[@"emphasis"] = ((TRButton *)self.control).emphasis ?: @"standard";
    result[@"hasSymbol"] = @(((NSButton *)self.control).image != nil);
    result[@"bordered"] = @(((NSButton *)self.control).bordered);
    result[@"alignment"] = @(((NSButton *)self.control).alignment);
    TRButton *button = (TRButton *)self.control;
    if ([button.emphasis isEqual:@"primary"] && button.enabled) {
      CGFloat background = TRLuminance(button.bezelColor), foreground = TRLuminance(button.contentTintColor);
      result[@"primaryColorContrast"] = @((MAX(background,foreground)+0.05)/(MIN(background,foreground)+0.05));
    }
  }
  if ([self.spec[@"glass"] boolValue]) result[@"material"] = [self.control isKindOfClass:NSGlassEffectView.class] ? @"glass" : @"opaque";
  if ([self.spec[@"kind"] isEqual:@"secure"]) { result[@"value"] = @"[redacted]"; result[@"hasValue"] = @(((NSSecureTextField *)self.control).stringValue.length > 0); }
  else if ([self.spec[@"kind"] isEqual:@"input"]) result[@"value"] = [self.control isKindOfClass:NSScrollView.class] ? ((NSTextView *)((NSScrollView *)self.control).documentView).string : ((NSTextField *)self.control).stringValue;
  if ([self.spec[@"kind"] isEqual:@"text"]) {
    NSTextView *text = (NSTextView *)self.control; result[@"text"] = text.string; result[@"selectable"] = @(text.selectable);
    NSMutableArray *cells = [NSMutableArray array], *runs = [NSMutableArray array];
    NSMutableSet *seen = [NSMutableSet set];
    [text.attributedString enumerateAttributesInRange:NSMakeRange(0,text.string.length) options:0 usingBlock:^(NSDictionary *attributes, NSRange range, BOOL *stop) {
      NSParagraphStyle *style = attributes[NSParagraphStyleAttributeName];
      for (NSTextBlock *block in style.textBlocks) if ([block isKindOfClass:NSTextTableBlock.class] && ![seen containsObject:block]) {
        [seen addObject:block]; NSTextTableBlock *cell = (NSTextTableBlock *)block;
        [cells addObject:@{@"row":@(cell.startingRow),@"column":@(cell.startingColumn)}];
      }
      NSFontTraitMask traits = [NSFontManager.sharedFontManager traitsOfFont:attributes[NSFontAttributeName]];
      if (traits & (NSBoldFontMask|NSItalicFontMask)) [runs addObject:@{@"text":[text.string substringWithRange:range],@"bold":@((traits & NSBoldFontMask) != 0),@"italic":@((traits & NSItalicFontMask) != 0)}];
    }];
    result[@"tableCells"] = cells; result[@"styledRuns"] = runs;
  }
  if ([self.spec[@"kind"] isEqual:@"label"]) result[@"text"] = ((NSTextField *)self.control).stringValue;
  if ([self.spec[@"kind"] isEqual:@"chart"]) {
    result[@"points"] = ((TRChart *)self.control).points;
    result[@"bars"] = [(TRChart *)self.control geometry];
    result[@"accessibleValues"] = self.control.accessibilityValue;
    [self.control.effectiveAppearance performAsCurrentDrawingAppearance:^{
      result[@"graphicContrast"] = @(TRContrast(((TRChart *)self.control).accent,NSColor.textBackgroundColor));
    }];
  }
  if ([self.control isKindOfClass:NSButton.class]) { result[@"title"] = ((NSButton *)self.control).title; result[@"checked"] = @(((NSButton *)self.control).state == NSControlStateValueOn); }
  if ([self.control isKindOfClass:NSPopUpButton.class]) result[@"selected"] = ((NSPopUpButton *)self.control).selectedItem.representedObject ?: @"";
  if ([self.control isKindOfClass:NSSplitView.class]) result[@"vertical"] = @(((NSSplitView *)self.control).vertical);
  if ([self.spec[@"kind"] isEqual:@"input"]) {
    NSTextView *input = [self.control isKindOfClass:NSScrollView.class] ? (NSTextView *)((NSScrollView *)self.control).documentView : (NSTextView *)((NSTextField *)self.control).currentEditor;
    if (input) { result[@"enabled"] = @(input.editable); result[@"selection"] = NSStringFromRange(input.selectedRange); result[@"marked"] = @(input.hasMarkedText); }
  }
  if ([self.spec[@"kind"] isEqual:@"table"]) {
    result[@"selected"] = [self selectedRowId] ?: @""; result[@"rows"] = self.spec[@"rows"] ?: @[];
    NSTableView *table = (NSTableView *)((NSScrollView *)self.control).documentView;
    result[@"rowHeight"] = @(table.rowHeight); result[@"tableStyle"] = @(table.style);
    if (table.numberOfRows) {
      TRResearchCell *cell = (TRResearchCell *)[table viewAtColumn:0 row:0 makeIfNecessary:YES];
      result[@"titleLines"] = @(cell.textField.maximumNumberOfLines);
      result[@"titleFrame"] = NSStringFromRect(cell.textField.frame);
      NSFont *font = cell.textField.font;
      result[@"titleLineHeight"] = @(ceil(font.ascender-font.descender+font.leading));
      NSRect required = [cell.textField.attributedStringValue boundingRectWithSize:NSMakeSize(MAX(20,cell.textField.frame.size.width),100000) options:NSStringDrawingUsesLineFragmentOrigin|NSStringDrawingUsesFontLeading];
      result[@"titleRequiredHeight"] = @(required.size.height);
    }
    if (table.numberOfRows) result[@"rowFontSize"] = @(((NSTableCellView *)[table viewAtColumn:0 row:0 makeIfNecessary:YES]).textField.font.pointSize);
  }
  if ([self.control isKindOfClass:NSControl.class]) result[@"enabled"] = @(((NSControl *)self.control).enabled);
  if ([self.control isKindOfClass:NSScrollView.class]) { result[@"documentClass"] = NSStringFromClass(((NSScrollView *)self.control).documentView.class); result[@"scrollOrigin"] = NSStringFromPoint(((NSScrollView *)self.control).contentView.bounds.origin); }
  NSMutableArray *children = [NSMutableArray array]; for (TRNode *child in self.nodes) [children addObject:[child inspect]]; result[@"children"] = children;
  return result;
}
@end
