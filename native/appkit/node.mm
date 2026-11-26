#import "nodeInternal.h"

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
    if ([spec[@"kind"] isEqual:@"table"]) {
      NSTableView *table = (NSTableView *)((NSScrollView *)self.control).documentView;
      NSRange visible = [table rowsInRect:table.visibleRect];
      if (visible.location != NSNotFound) for (NSUInteger i = visible.location; i < NSMaxRange(visible); i++) {
        NSTableCellView *cell = [table viewAtColumn:0 row:i makeIfNecessary:NO];
        if ([cell isKindOfClass:TRResearchCell.class]) {
          TRResearchCell *research = (TRResearchCell *)cell;
          research.detailField.textColor = self.host.increaseContrast ? NSColor.labelColor : NSColor.secondaryLabelColor;
          // Glyph tints follow a live Increase Contrast change, keeping the selection style.
          research.highContrast = self.host.increaseContrast; research.backgroundStyle = research.backgroundStyle;
        }
      }
    }
    if ([spec[@"kind"] isEqual:@"button"]) {
      TRButton *button = (TRButton *)self.control;
      button.emphasis = spec[@"emphasis"];
      BOOL navigation = [button.emphasis isEqual:@"navigation"], quiet = [button.emphasis isEqual:@"quiet"], primary = [button.emphasis isEqual:@"primary"];
      button.bordered = !navigation && !quiet;
      button.hasDestructiveAction = [spec[@"destructive"] boolValue];
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
  if ([self.spec[@"kind"] isEqual:@"sidebar"]) ((NSTableView *)((NSScrollView *)self.control).documentView).backgroundColor = NSColor.clearColor;
  [self updateControlAppearance];
  self.needsDisplay = YES;
}
- (instancetype)initWithHost:(TRHost *)host spec:(NSDictionary *)spec {
  self = [super initWithFrame:NSZeroRect];
  if (self) { self.host = host; self.nodes = @[]; self.stackedFraction = 0.4; [self update:spec]; }
  return self;
}
- (NSFont *)font {
  // macOS text styles at system sizes, scaled by the window zoom. Headings are Title 1; a point
  // size is kept only where a node sets one (reading text, symbols).
  NSString *style = self.spec[@"textStyle"] ?: ([self.spec[@"weight"] isEqual:@"title"] ? @"title1" : @"body");
  CGFloat size = (self.spec[@"size"] ? [self.spec[@"size"] doubleValue] : TRTextStyleSize(style)) * self.host.zoom;
  // Headline is bold by definition, as the system style is.
  BOOL bold = [self.spec[@"weight"] isEqual:@"bold"] || [self.spec[@"weight"] isEqual:@"title"] || [style isEqual:@"headline"];
  return bold ? [NSFont boldSystemFontOfSize:size] : [NSFont systemFontOfSize:size];
}
- (void)createControl {
  NSString *kind = self.spec[@"kind"];
  if ([kind isEqual:@"column"] || [kind isEqual:@"row"]) {
    if ([self.spec[@"adaptiveScroll"] boolValue]) {
      NSScrollView *scroll = [NSScrollView new]; scroll.hasVerticalScroller = YES; scroll.drawsBackground = NO; scroll.autohidesScrollers = YES;
      scroll.automaticallyAdjustsContentInsets = NO;
      self.container = [TRCanvas new]; scroll.documentView = self.container; self.control = scroll;
    } else [self updateMaterial];
  } else if ([kind isEqual:@"split"] && [self.spec[@"windowSidebar"] boolValue]) {
    TRSplit *split = [TRSplit new]; split.node = self; split.vertical = YES; split.dividerStyle = NSSplitViewDividerStyleThin;
    TRWindowSplitController *controller = [TRWindowSplitController new]; controller.node = self;
    controller.splitView = split; self.splitController = controller; self.control = controller.view;
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
    // TextKit 1 from the start: heightForWidth measures through the layout manager. A default
    // (TextKit 2) view switches to TextKit 1 on first access and could report an empty layout
    // (8 pt) for that measurement, leaving a long reading pane unscrollable.
    NSTextView *text = [NSTextView textViewUsingTextLayoutManager:NO]; text.frame = NSMakeRect(0,0,500,100);
    text.editable = NO; text.selectable = YES; text.drawsBackground = NO; text.delegate = self;
    text.textContainerInset = NSMakeSize(0, 4); text.textContainer.lineFragmentPadding = 0;
    // heightForWidth sets the container width explicitly. Tracking the view width would reset it
    // to a stale view frame right after the measurement and invalidate the layout just made
    // (an intermittently empty 8 pt reading pane: asked 1000, view 500, laid-out height 0).
    text.textContainer.widthTracksTextView = NO; text.verticallyResizable = YES; text.horizontallyResizable = NO;
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
  } else if ([kind isEqual:@"symbol"]) {
    NSImageView *image = [NSImageView new]; image.imageScaling = NSImageScaleProportionallyDown;
    // Decorative: the adjacent title carries the meaning for VoiceOver.
    image.accessibilityElement = NO; self.control = image;
  } else if ([kind isEqual:@"segmented"]) {
    NSSegmentedControl *segmented = [NSSegmentedControl new];
    segmented.trackingMode = NSSegmentSwitchTrackingSelectOne; segmented.segmentStyle = NSSegmentStyleAutomatic;
    segmented.target = self; segmented.action = @selector(trigger:); self.control = segmented;
  } else if ([kind isEqual:@"progress"]) {
    NSProgressIndicator *progress = [NSProgressIndicator new];
    progress.style = NSProgressIndicatorStyleBar; progress.displayedWhenStopped = YES; progress.minValue = 0;
    self.control = progress;
  } else if ([kind isEqual:@"sidebar"]) {
    NSScrollView *scroll = [NSScrollView new]; scroll.hasVerticalScroller = YES; scroll.autohidesScrollers = YES; scroll.drawsBackground = NO;
    scroll.automaticallyAdjustsContentInsets = NO;
    TRTable *table = [TRTable new]; table.node = self; table.delegate = self; table.dataSource = self;
    table.headerView = nil; table.style = NSTableViewStyleSourceList; table.backgroundColor = NSColor.clearColor;
    table.allowsEmptySelection = NO; table.rowSizeStyle = NSTableViewRowSizeStyleCustom;
    NSTableColumn *column = [[NSTableColumn alloc] initWithIdentifier:@"workspace"]; [table addTableColumn:column];
    table.columnAutoresizingStyle = NSTableViewLastColumnOnlyAutoresizingStyle;
    scroll.documentView = table; self.control = scroll;
  } else if ([kind isEqual:@"table"]) {
    NSScrollView *scroll = [NSScrollView new]; scroll.hasVerticalScroller = YES; scroll.autohidesScrollers = YES; scroll.drawsBackground = NO;
    TRTable *table = [TRTable new]; table.node = self; table.delegate = self; table.dataSource = self;
    // Rows with a link can be dragged as a copy to other apps (Zotero, Obsidian, Mail, Finder).
    [table setDraggingSourceOperationMask:NSDragOperationCopy forLocal:NO];
    [table setDraggingSourceOperationMask:NSDragOperationNone forLocal:YES];
    // Double-click opens the row in its own window when the scene offers it (Mail pattern).
    table.target = self; table.doubleAction = @selector(openRowWindow:);
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
  self.control.accessibilityHelp = spec[@"help"];
  if (spec[@"help"]) self.control.toolTip = spec[@"help"];
  if ([self.control isKindOfClass:NSControl.class]) {
    NSControl *control = (NSControl *)self.control; control.enabled = spec[@"enabled"] ? [spec[@"enabled"] boolValue] : YES; control.font = self.font;
  }
  if ([kind isEqual:@"label"]) {
    NSTextField *label = (NSTextField *)self.control; label.stringValue = TRString(spec[@"text"] ?: spec[@"title"]);
    label.maximumNumberOfLines = [spec[@"maxLines"] integerValue];
    label.lineBreakMode = spec[@"maxLines"] ? NSLineBreakByTruncatingTail : NSLineBreakByWordWrapping;
    label.toolTip = spec[@"maxLines"] ? label.stringValue : nil;
    label.textColor = [spec[@"weight"] isEqual:@"secondary"] && ![self.host increaseContrast] ? NSColor.secondaryLabelColor : NSColor.labelColor;
    label.alignment = [spec[@"align"] isEqual:@"center"] ? NSTextAlignmentCenter : NSTextAlignmentNatural;
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
    if ([kind isEqual:@"button"]) {
      // Return makes a default button; Command-Return submits without taking plain Return
      // from multiline text.
      NSString *shortcut = spec[@"shortcut"];
      button.keyEquivalent = shortcut ? @"\r" : @"";
      button.keyEquivalentModifierMask = [shortcut isEqual:@"command-return"] ? NSEventModifierFlagCommand : 0;
    }
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
  } else if ([kind isEqual:@"symbol"]) {
    NSImageView *image = (NSImageView *)self.control;
    image.image = [NSImage imageWithSystemSymbolName:spec[@"symbol"] accessibilityDescription:spec[@"title"]];
    image.symbolConfiguration = [NSImageSymbolConfiguration configurationWithPointSize:TRNumber(spec,@"size",40)*self.host.zoom weight:NSFontWeightLight];
    image.contentTintColor = self.host.increaseContrast ? NSColor.secondaryLabelColor : NSColor.tertiaryLabelColor;
  } else if ([kind isEqual:@"segmented"]) {
    NSSegmentedControl *segmented = (NSSegmentedControl *)self.control;
    NSArray *options = spec[@"options"];
    if (![old[@"options"] isEqual:options]) {
      segmented.segmentCount = (NSInteger)options.count;
      [options enumerateObjectsUsingBlock:^(NSDictionary *option, NSUInteger index, BOOL *stop) {
        [segmented setLabel:option[@"title"] forSegment:(NSInteger)index]; [segmented setWidth:0 forSegment:(NSInteger)index];
        [segmented setEnabled:option[@"enabled"] ? [option[@"enabled"] boolValue] : YES forSegment:(NSInteger)index];
      }];
    }
    NSUInteger index = [options indexOfObjectPassingTest:^BOOL(NSDictionary *option, NSUInteger i, BOOL *stop) { return [option[@"id"] isEqual:spec[@"selected"]]; }];
    if (index != NSNotFound) segmented.selectedSegment = (NSInteger)index;
  } else if ([kind isEqual:@"progress"]) {
    NSProgressIndicator *progress = (NSProgressIndicator *)self.control;
    BOOL determinate = spec[@"completed"] && spec[@"total"];
    progress.indeterminate = !determinate;
    if (determinate) {
      progress.maxValue = [spec[@"total"] doubleValue]; progress.doubleValue = [spec[@"completed"] doubleValue];
      progress.accessibilityValueDescription = [NSString stringWithFormat:@"%@ of %@",spec[@"completed"],spec[@"total"]];
      [progress stopAnimation:nil];
    } else {
      progress.accessibilityValueDescription = nil;
      // Honour Reduce Motion: an indeterminate bar stays static instead of animating.
      if (NSWorkspace.sharedWorkspace.accessibilityDisplayShouldReduceMotion) [progress stopAnimation:nil];
      else [progress startAnimation:nil];
    }
  } else if ([kind isEqual:@"sidebar"]) {
    NSTableView *table = (NSTableView *)((NSScrollView *)self.control).documentView;
    table.accessibilityLabel = spec[@"title"];
    table.enabled = spec[@"enabled"] ? [spec[@"enabled"] boolValue] : YES;
    CGFloat rowHeight = 30*self.host.zoom;
    if (table.rowHeight != rowHeight || ![old[@"rows"] isEqual:spec[@"rows"]]) { table.rowHeight = rowHeight; [table reloadData]; }
    NSInteger selected = -1, row = 0;
    for (NSDictionary *item in spec[@"rows"]) { if ([item[@"id"] isEqual:spec[@"selected"]]) selected = row; row++; }
    // A source list keeps one row selected; it shows none only when the scene selects none (a
    // local search covers every workspace), so a click in empty space never clears it.
    table.allowsEmptySelection = selected < 0;
    if (selected >= 0 && table.selectedRow != selected) [table selectRowIndexes:[NSIndexSet indexSetWithIndex:selected] byExtendingSelection:NO];
    else if (selected < 0 && table.selectedRow >= 0) [table deselectAll:nil];
  } else if ([kind isEqual:@"table"]) {
    NSTableView *table = (NSTableView *)((NSScrollView *)self.control).documentView;
    NSArray *columns = spec[@"columns"];
    BOOL columnsChanged = ![old[@"columns"] ?: @[] isEqual:columns ?: @[]];
    if (columnsChanged) {
      for (NSTableColumn *column in table.tableColumns.copy) [table removeTableColumn:column];
      for (NSDictionary *entry in columns ?: @[@{@"id":@"content",@"title":@""}]) {
        NSTableColumn *column = [[NSTableColumn alloc] initWithIdentifier:entry[@"id"]]; column.title = entry[@"title"]; column.resizingMask = NSTableColumnNoResizing;
        column.headerCell.alignment = [entry[@"alignment"] isEqual:@"right"] ? NSTextAlignmentRight : NSTextAlignmentLeft;
        [table addTableColumn:column];
      }
      table.headerView = columns ? [[NSTableHeaderView alloc] initWithFrame:NSMakeRect(0,0,100,24*self.host.zoom)] : nil;
      ((NSScrollView *)self.control).hasHorizontalScroller = columns != nil;
      table.columnAutoresizingStyle = NSTableViewNoColumnAutoresizing;
    }
    CGFloat rowHeight = (columns ? 26 : 70) * self.host.zoom;
    table.style = columns ? NSTableViewStylePlain : NSTableViewStyleInset;
    BOOL fontChanged = table.rowHeight != rowHeight;
    table.rowHeight = rowHeight;
    for (NSTableColumn *column in table.tableColumns) column.headerCell.font = [NSFont systemFontOfSize:TRTextStyleSize(@"callout")*self.host.zoom weight:NSFontWeightMedium];
    table.backgroundColor = NSColor.textBackgroundColor;
    NSPoint origin = ((NSScrollView *)self.control).contentView.bounds.origin;
    if (fontChanged || columnsChanged || ![old[@"rows"] isEqual:spec[@"rows"]]) [table reloadData];
    NSInteger selected = -1, row = 0;
    for (NSDictionary *item in spec[@"rows"]) { if ([item[@"id"] isEqual:spec[@"selected"]]) selected = row; row++; }
    if (selected < 0) [table deselectAll:nil];
    else if (table.selectedRow != selected) [table selectRowIndexes:[NSIndexSet indexSetWithIndex:selected] byExtendingSelection:NO];
    [((NSScrollView *)self.control).contentView scrollToPoint:origin];
    if (selected >= 0 && ![old[@"selected"] isEqual:spec[@"selected"]]) self.revealSelection = YES;
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
    if (node.superview != parent && !self.splitController) [parent addSubview:node];
  }
  for (TRNode *node in existing.allValues) [node removeFromSuperview];
  self.nodes = children;
  if (self.splitController && children.count == 2) {
    NSArray<NSSplitViewItem *> *items = self.splitController.splitViewItems;
    if (items.count != 2 || items[0].viewController.view != children[0] || items[1].viewController.view != children[1]) {
      for (NSSplitViewItem *item in items.copy) [self.splitController removeSplitViewItem:item];
      NSViewController *sidebar = [NSViewController new], *content = [NSViewController new];
      sidebar.view = children[0]; content.view = children[1];
      NSSplitViewItem *sidebarItem = [NSSplitViewItem sidebarWithViewController:sidebar];
      // Only the scene collapses the sidebar (toolbar toggle): neither a drag nor a narrow window
      // may collapse it without the presenter knowing.
      sidebarItem.canCollapse = NO; sidebarItem.holdingPriority = NSLayoutPriorityDefaultLow + 10;
      [self.splitController addSplitViewItem:sidebarItem];
      [self.splitController addSplitViewItem:[NSSplitViewItem splitViewItemWithViewController:content]];
    }
    NSSplitViewItem *sidebarItem = self.splitController.splitViewItems[0];
    // Unscaled points, as the saved preference and the other splits use: the drag and save
    // limits agree at every zoom.
    sidebarItem.minimumThickness = TRNumber(spec,@"minWidth",180);
    sidebarItem.maximumThickness = TRNumber(spec,@"maxWidth",360);
    // The divider counts against the content minimum so both minimums fit the 820 pt window.
    self.splitController.splitViewItems[1].minimumThickness = TRNumber(spec,@"minContentWidth",200) - [self splitView].dividerThickness;
    [self splitView].accessibilityLabel = spec[@"title"]; [self splitView].accessibilityHelp = spec[@"help"];
    // Collapse here, outside layout: it changes the split view controller's constraints. The
    // split item's own animator slides the sidebar (Finder, Mail); Reduce Motion is instant.
    BOOL collapsed = [spec[@"compactPane"] isEqual:@"detail"];
    // While an animation runs, the item can still report its old state (a second toggle before
    // the run loop turns), so compare with the requested state.
    if ((self.animatingSplit ? self.splitTarget : sidebarItem.collapsed) != collapsed) {
      self.splitTarget = collapsed;
      if (old && [self.host animatesTransitions]) {
        // A toggle during a running animation starts a newer one; only the latest completion
        // ends the pause. An older animation can finish after it, so whichever completion comes
        // once no animation is pending puts the item in the requested state, then reconciles.
        self.animatingSplit = YES; NSUInteger generation = ++self.splitAnimation;
        self.animationWidths = [NSMutableSet set];
        // A collapsed sidebar pane is hidden but keeps its last frame width: it starts at 0.
        NSView *pane = self.splitController.splitView.arrangedSubviews.firstObject;
        self.animationFrom = pane.isHidden ? 0 : pane.frame.size.width;
        __weak TRNode *weakSelf = self;
        [NSAnimationContext runAnimationGroup:^(NSAnimationContext *context) {
          context.allowsImplicitAnimation = YES;
          sidebarItem.animator.collapsed = collapsed;
        } completionHandler:^{
          TRNode *node = weakSelf; if (!node) return;
          if (node.splitAnimation == generation) { node.animatingSplit = NO; node.animationsCompleted++; }
          if (node.animatingSplit) return;
          if (sidebarItem.collapsed != node.splitTarget) {
            sidebarItem.collapsed = node.splitTarget; [node.splitController.view layoutSubtreeIfNeeded];
          }
          // A finished show or hide earns a fresh attempt to restore the saved width.
          node.reconcileAttempt = 0; node.reconcileRetries = 0; [node reconcileWindowSplit];
        }];
      } else { ++self.splitAnimation; self.animatingSplit = NO; sidebarItem.collapsed = collapsed; }
    }
  }
  if ([kind isEqual:@"scroll"] && old && (![old[@"clearRevision"] ?: @0 isEqual:spec[@"clearRevision"] ?: @0] || ![[old[@"children"] firstObject][@"id"] isEqual:[spec[@"children"] firstObject][@"id"]])) {
    self.resetScrollAfterLayout = YES;
  }
  if ([spec[@"adaptiveScroll"] boolValue] && old && ![[old[@"children"] lastObject][@"id"] isEqual:[spec[@"children"] lastObject][@"id"]]) self.resetScrollAfterLayout = YES;
  [self updateControlAppearance];
  self.applying = NO; self.needsLayout = YES;
}
- (NSSplitView *)splitView {
  // A controller-hosted split view sits inside the controller's container view.
  if (self.splitController) return self.splitController.splitView;
  return [self.control isKindOfClass:NSSplitView.class] ? (NSSplitView *)self.control : nil;
}
- (TRNode *)find:(NSString *)identifier {
  if ([self.identifier isEqual:identifier]) return self;
  for (TRNode *child in self.nodes) { TRNode *found = [child find:identifier]; if (found) return found; }
  return nil;
}
@end
