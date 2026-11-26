#import "nodeInternal.h"

@implementation TRNode (Interaction)
- (NSInteger)numberOfRowsInTableView:(NSTableView *)table { return [self.spec[@"rows"] count]; }
- (NSView *)tableView:(NSTableView *)table viewForTableColumn:(NSTableColumn *)column row:(NSInteger)row {
  NSArray *rows = self.spec[@"rows"]; if (row < 0 || row >= (NSInteger)rows.count) return nil;
  NSDictionary *item = rows[row];
  if ([self.spec[@"kind"] isEqual:@"sidebar"]) return TRSidebarCellView(item,self.host.zoom);
  if (self.spec[@"columns"]) {
    NSDictionary *definition = nil; for (NSDictionary *entry in self.spec[@"columns"]) if ([entry[@"id"] isEqual:column.identifier]) definition = entry;
    TRDataCell *cell = [TRDataCell new]; cell.zoom = self.host.zoom;
    NSTextField *label = [NSTextField labelWithString:TRString(item[@"cells"][column.identifier])];
    label.font = [NSFont monospacedDigitSystemFontOfSize:13*self.host.zoom weight:NSFontWeightRegular];
    label.maximumNumberOfLines = 1; label.lineBreakMode = NSLineBreakByTruncatingTail;
    label.alignment = [definition[@"alignment"] isEqual:@"right"] ? NSTextAlignmentRight : NSTextAlignmentLeft;
    [cell addSubview:label]; cell.textField = label; cell.toolTip = label.stringValue;
    cell.accessibilityLabel = [NSString stringWithFormat:@"%@: %@. %@",definition[@"title"],label.stringValue,item[@"title"]];
    return cell;
  }
  TRResearchCell *cell = [TRResearchCell new]; cell.zoom = self.host.zoom;
  NSTextField *label = [NSTextField wrappingLabelWithString:item[@"title"]];
  label.font = [NSFont systemFontOfSize:self.font.pointSize weight:NSFontWeightMedium]; label.maximumNumberOfLines = 2; label.lineBreakMode = NSLineBreakByWordWrapping;
  label.cell.wraps = YES; label.cell.usesSingleLineMode = NO; label.cell.truncatesLastVisibleLine = YES;
  label.preferredMaxLayoutWidth = MAX(30,column.width-24*self.host.zoom);
  [cell addSubview:label]; cell.textField = label;
  NSTextField *detail = [NSTextField labelWithString:TRString(item[@"subtitle"])]; detail.font = [NSFont systemFontOfSize:TRTextStyleSize(@"callout")*self.host.zoom]; detail.textColor = self.host.increaseContrast ? NSColor.labelColor : NSColor.secondaryLabelColor;
  detail.lineBreakMode = NSLineBreakByTruncatingTail;
  [cell addSubview:detail]; cell.detailField = detail; cell.toolTip = item[@"title"];
  cell.highContrast = self.host.increaseContrast;
  NSImage *kind = [item[@"symbol"] isKindOfClass:NSString.class] ? [NSImage imageWithSystemSymbolName:item[@"symbol"] accessibilityDescription:item[@"symbolLabel"]] : nil;
  if (kind) {
    NSImageView *view = [NSImageView imageViewWithImage:kind]; view.accessibilityElement = NO;
    view.symbolConfiguration = [NSImageSymbolConfiguration configurationWithPointSize:13*self.host.zoom weight:NSFontWeightRegular];
    [cell addSubview:view]; cell.kindView = view; cell.symbolName = item[@"symbol"];
  }
  if ([item[@"saved"] boolValue]) {
    NSImageView *view = [NSImageView imageViewWithImage:[NSImage imageWithSystemSymbolName:@"star.fill" accessibilityDescription:@"Saved"]];
    view.accessibilityElement = NO;
    view.symbolConfiguration = [NSImageSymbolConfiguration configurationWithPointSize:12*self.host.zoom weight:NSFontWeightRegular];
    [cell addSubview:view]; cell.savedView = view;
  }
  cell.backgroundStyle = NSBackgroundStyleNormal;
  NSMutableArray *spoken = [NSMutableArray arrayWithObject:item[@"title"]];
  if ([item[@"symbolLabel"] isKindOfClass:NSString.class] && kind) [spoken addObject:item[@"symbolLabel"]];
  if (TRString(item[@"subtitle"]).length) [spoken addObject:item[@"subtitle"]];
  if (cell.savedView) [spoken addObject:@"Saved"];
  cell.accessibilityLabel = [[spoken componentsJoinedByString:@". "] stringByAppendingString:@"."];
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
- (void)openRowWindow:(id)sender {
  NSTableView *table = (NSTableView *)((NSScrollView *)self.control).documentView;
  // A real double-click acts on the clicked row only (not empty space); the fixture path (nil
  // sender) uses the selection it just made.
  NSArray *rows = self.spec[@"rows"]; NSInteger row = sender ? table.clickedRow : table.selectedRow;
  if (!self.spec[@"openWindow"] || row < 0 || row >= (NSInteger)rows.count) return;
  [self.host emit:self.spec[@"openWindow"] value:rows[(NSUInteger)row][@"id"] secret:NO];
}
- (void)contextRow { [self.host emit:self.spec[@"context"] value:[self selectedRowId] secret:NO]; }
- (NSPasteboardItem *)pasteboardItemForRow:(NSInteger)row {
  NSArray *rows = self.spec[@"rows"]; if (row < 0 || row >= (NSInteger)rows.count) return nil;
  NSDictionary *drag = rows[(NSUInteger)row][@"drag"]; if (![drag isKindOfClass:NSDictionary.class]) return nil;
  NSURL *url = [NSURL URLWithString:TRString(drag[@"url"])];
  // The scene already admits only https links; check again before anything leaves the app.
  if (![url.scheme.lowercaseString isEqual:@"https"]) return nil;
  NSPasteboardItem *item = [NSPasteboardItem new];
  [item setString:url.absoluteString forType:NSPasteboardTypeURL];
  [item setString:TRString(drag[@"title"]) forType:@"public.url-name"];
  [item setString:TRString(drag[@"text"]) forType:NSPasteboardTypeString];
  return item;
}
- (id<NSPasteboardWriting>)tableView:(NSTableView *)table pasteboardWriterForRow:(NSInteger)row {
  NSPasteboardItem *item = [self.spec[@"kind"] isEqual:@"table"] ? [self pasteboardItemForRow:row] : nil;
  // AppKit asks for the writer synchronously when a drag starts inside mouseDown; the session
  // itself may run later, so mark the drag here, before mouseDown would open the row.
  if (item && [table isKindOfClass:TRTable.class]) ((TRTable *)table).dragged = YES;
  return item;
}
- (void)tableView:(NSTableView *)table draggingSession:(NSDraggingSession *)session willBeginAtPoint:(NSPoint)point forRowIndexes:(NSIndexSet *)rows {
  if ([table isKindOfClass:TRTable.class]) ((TRTable *)table).dragged = YES;
}
- (void)tableView:(NSTableView *)table draggingSession:(NSDraggingSession *)session endedAtPoint:(NSPoint)point operation:(NSDragOperation)operation {
  if ([table isKindOfClass:TRTable.class]) ((TRTable *)table).dragged = YES;
}
- (void)share {
  NSURL *url = [NSURL URLWithString:TRString(self.spec[@"share"][@"url"])];
  if (![url.scheme.lowercaseString isEqual:@"https"]) return;
  // Fixtures record the request; opening system sharing UI would block an unattended run.
  if (self.host.fixture) { self.sharedURL = url.absoluteString; return; }
  NSSharingServicePicker *picker = [[NSSharingServicePicker alloc] initWithItems:@[url]];
  [picker showRelativeToRect:self.control.bounds ofView:self.control preferredEdge:NSRectEdgeMinY];
}
- (void)trigger:(id)sender {
  if (self.applying || [self.host.popover suppressesTriggerFrom:self.identifier]) return;
  if ([self.control isKindOfClass:NSControl.class] && !((NSControl *)self.control).enabled) return;
  if ([self.spec[@"share"] isKindOfClass:NSDictionary.class]) { [self share]; return; }
  NSString *kind = self.spec[@"kind"];
  if ([kind isEqual:@"select"]) [self.host emit:self.spec[@"action"] value:((NSPopUpButton *)self.control).selectedItem.representedObject secret:NO];
  else if ([kind isEqual:@"segmented"]) {
    NSInteger index = ((NSSegmentedControl *)self.control).selectedSegment; NSArray *options = self.spec[@"options"];
    if (index >= 0 && index < (NSInteger)options.count) [self.host emit:self.spec[@"action"] value:options[(NSUInteger)index][@"id"] secret:NO];
  }
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
- (NSDictionary *)inspect {
  NSMutableDictionary *result = [@{@"id":self.identifier ?: @"", @"kind":self.spec[@"kind"], @"class":self.control ? NSStringFromClass(self.control.class) : NSStringFromClass(self.class), @"frame":NSStringFromRect(self.frame), @"label":self.control.accessibilityLabel ?: @""} mutableCopy];
  result[@"appearance"] = self.effectiveAppearance.name;
  result[@"hidden"] = @(self.isHiddenOrHasHiddenAncestor);
  if (self.spec[@"compactPane"]) result[@"compactPane"] = self.spec[@"compactPane"];
  if (self.control) result[@"controlAppearance"] = self.control.effectiveAppearance.name;
  if (self.spec[@"surface"]) result[@"surface"] = self.spec[@"surface"];
  if ([self.control isKindOfClass:TRButton.class]) {
    result[@"emphasis"] = ((TRButton *)self.control).emphasis ?: @"standard";
    result[@"hasSymbol"] = @(((NSButton *)self.control).image != nil);
    result[@"bordered"] = @(((NSButton *)self.control).bordered);
    result[@"destructive"] = @(((NSButton *)self.control).hasDestructiveAction);
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
  if ([self.spec[@"kind"] isEqual:@"label"] || [self.spec[@"kind"] isEqual:@"text"]) {
    NSFont *font = [self.spec[@"kind"] isEqual:@"text"] ? ((NSTextView *)self.control).font : ((NSTextField *)self.control).font;
    result[@"fontSize"] = @(font.pointSize); result[@"fontBold"] = @((font.fontDescriptor.symbolicTraits & NSFontDescriptorTraitBold) != 0);
    NSString *style = self.spec[@"textStyle"] ?: ([self.spec[@"weight"] isEqual:@"title"] ? @"title1" : @"body");
    result[@"styleSize"] = @(TRTextStyleSize(style));
  }
  if ([self.spec[@"kind"] isEqual:@"label"]) { result[@"text"] = ((NSTextField *)self.control).stringValue; result[@"centered"] = @(((NSTextField *)self.control).alignment == NSTextAlignmentCenter); }
  if ([self.spec[@"kind"] isEqual:@"symbol"]) { NSImageView *image = (NSImageView *)self.control; result[@"hasImage"] = @(image.image != nil); result[@"exposed"] = @(image.isAccessibilityElement); }
  if ([self.spec[@"kind"] isEqual:@"chart"]) {
    result[@"points"] = ((TRChart *)self.control).points;
    result[@"bars"] = [(TRChart *)self.control geometry];
    result[@"accessibleValues"] = self.control.accessibilityValue;
    [self.control.effectiveAppearance performAsCurrentDrawingAppearance:^{
      result[@"graphicContrast"] = @(TRContrast(((TRChart *)self.control).accent,NSColor.textBackgroundColor));
    }];
  }
  if ([self.spec[@"share"] isKindOfClass:NSDictionary.class]) result[@"sharedURL"] = self.sharedURL ?: @"";
  if ([self.spec[@"kind"] isEqual:@"table"] && [self.spec[@"rows"] count]) {
    TRTable *table = (TRTable *)((NSScrollView *)self.control).documentView;
    NSPasteboardItem *item = [self pasteboardItemForRow:0];
    result[@"dragItem"] = item ? @{@"url":[item stringForType:NSPasteboardTypeURL] ?: @"",@"title":[item stringForType:@"public.url-name"] ?: @"",@"text":[item stringForType:NSPasteboardTypeString] ?: @""} : @{};
    NSDraggingSession *noSession = nil;
    result[@"dragOutside"] = @([table draggingSession:noSession sourceOperationMaskForDraggingContext:NSDraggingContextOutsideApplication] == NSDragOperationCopy);
  }
  if ([self.spec[@"kind"] isEqual:@"button"]) {
    NSButton *button = (NSButton *)self.control;
    result[@"keyEquivalent"] = button.keyEquivalent ?: @"";
    result[@"keyModifiers"] = (button.keyEquivalentModifierMask & NSEventModifierFlagCommand) ? @"command" : @"";
  }
  if ([self.control isKindOfClass:NSButton.class]) { result[@"title"] = ((NSButton *)self.control).title; result[@"checked"] = @(((NSButton *)self.control).state == NSControlStateValueOn); }
  if ([self.control isKindOfClass:NSPopUpButton.class]) result[@"selected"] = ((NSPopUpButton *)self.control).selectedItem.representedObject ?: @"";
  if ([self.spec[@"kind"] isEqual:@"segmented"]) {
    NSSegmentedControl *segmented = (NSSegmentedControl *)self.control; NSMutableArray *segments = [NSMutableArray array];
    for (NSInteger index = 0; index < segmented.segmentCount; index++)
      [segments addObject:@{@"label":[segmented labelForSegment:index] ?: @"",@"enabled":@([segmented isEnabledForSegment:index]),@"selected":@([segmented isSelectedForSegment:index])}];
    NSArray *options = self.spec[@"options"]; NSInteger index = segmented.selectedSegment;
    result[@"segments"] = segments; result[@"selected"] = index >= 0 && index < (NSInteger)options.count ? options[(NSUInteger)index][@"id"] : @"";
    result[@"intrinsicWidth"] = @(segmented.intrinsicContentSize.width);
  }
  if ([self splitView]) result[@"vertical"] = @([self splitView].vertical);
  if (self.splitController) {
    result[@"animating"] = @(self.animatingSplit); result[@"widthEvents"] = @(self.widthEvents);
    result[@"animationsCompleted"] = @(self.animationsCompleted);
    // Frames strictly between the start and end widths prove a visible slide, independent of
    // how often a test can sample from outside the app.
    NSView *pane = self.splitController.splitView.arrangedSubviews.firstObject;
    CGFloat to = pane.isHidden ? 0 : pane.frame.size.width;
    CGFloat low = MIN(self.animationFrom, to) + 0.5, high = MAX(self.animationFrom, to) - 0.5; NSUInteger between = 0;
    for (NSNumber *width in self.animationWidths) if (width.doubleValue > low && width.doubleValue < high) between++;
    result[@"animationSteps"] = @(between);
  }
  if ([self.spec[@"kind"] isEqual:@"input"]) {
    NSTextView *input = [self.control isKindOfClass:NSScrollView.class] ? (NSTextView *)((NSScrollView *)self.control).documentView : (NSTextView *)((NSTextField *)self.control).currentEditor;
    if (input) { result[@"enabled"] = @(input.editable); result[@"selection"] = NSStringFromRange(input.selectedRange); result[@"marked"] = @(input.hasMarkedText); }
  }
  if ([self.spec[@"kind"] isEqual:@"progress"]) {
    NSProgressIndicator *progress = (NSProgressIndicator *)self.control;
    result[@"indeterminate"] = @(progress.indeterminate); result[@"progressValue"] = @(progress.doubleValue);
    result[@"progressMaximum"] = @(progress.maxValue); result[@"accessibleValue"] = progress.accessibilityValueDescription ?: @"";
  }
  if ([self.spec[@"kind"] isEqual:@"sidebar"]) {
    NSTableView *table = (NSTableView *)((NSScrollView *)self.control).documentView;
    result[@"selected"] = [self selectedRowId] ?: @""; result[@"rows"] = self.spec[@"rows"] ?: @[];
    result[@"rowHeight"] = @(table.rowHeight); result[@"tableStyle"] = @(table.style); result[@"sourceList"] = @(table.style == NSTableViewStyleSourceList);
    result[@"enabled"] = @(table.enabled); result[@"accessibilityRole"] = table.accessibilityRole ?: @"";
  }
  if ([self.spec[@"kind"] isEqual:@"table"]) {
    if (self.spec[@"columns"]) result[@"columns"] = self.spec[@"columns"];
    result[@"selected"] = [self selectedRowId] ?: @""; result[@"rows"] = self.spec[@"rows"] ?: @[];
    NSTableView *table = (NSTableView *)((NSScrollView *)self.control).documentView;
    result[@"rowHeight"] = @(table.rowHeight); result[@"tableStyle"] = @(table.style);
    if (self.spec[@"columns"] && table.selectedRow >= 0) {
      NSMutableArray *cells = [NSMutableArray array];
      for (NSUInteger i = 0; i < table.tableColumns.count; i++) {
        NSTableCellView *cell = [table viewAtColumn:i row:table.selectedRow makeIfNecessary:YES];
        [cell layoutSubtreeIfNeeded];
        [cells addObject:@{@"column":table.tableColumns[i].identifier,@"text":cell.textField.stringValue ?: @"",@"cellFrame":NSStringFromRect(cell.frame),@"textFrame":NSStringFromRect(cell.textField.frame)}];
      }
      result[@"selectedCells"] = cells;
    }
    if (table.numberOfRows) {
      TRResearchCell *cell = (TRResearchCell *)[table viewAtColumn:0 row:0 makeIfNecessary:YES];
      result[@"titleLines"] = @(cell.textField.maximumNumberOfLines);
      result[@"titleTruncates"] = @(cell.textField.cell.truncatesLastVisibleLine);
      result[@"titleFrame"] = NSStringFromRect(cell.textField.frame);
      NSFont *font = cell.textField.font;
      result[@"titleLineHeight"] = @(ceil(font.ascender-font.descender+font.leading));
      NSRect required = [cell.textField.attributedStringValue boundingRectWithSize:NSMakeSize(MAX(20,cell.textField.frame.size.width),100000) options:NSStringDrawingUsesLineFragmentOrigin|NSStringDrawingUsesFontLeading];
      result[@"titleRequiredHeight"] = @(required.size.height);
      NSMutableArray *glyphs = [NSMutableArray array];
      for (NSInteger row = 0; row < MIN(table.numberOfRows,(NSInteger)20); row++) {
        TRResearchCell *research = (TRResearchCell *)[table viewAtColumn:0 row:row makeIfNecessary:YES];
        if (![research isKindOfClass:TRResearchCell.class]) break;
        [research layoutSubtreeIfNeeded];
        __block CGFloat contrast = 0, selectedContrast = 0;
        if (research.savedView) [research.effectiveAppearance performAsCurrentDrawingAppearance:^{
          NSColor *tint = TRSavedColor(research.highContrast);
          contrast = TRContrast(tint,NSColor.textBackgroundColor);
          selectedContrast = TRContrast(tint,NSColor.unemphasizedSelectedContentBackgroundColor);
        }];
        // What the title cell needs at its frame width (cell insets included), up to two lines.
        NSSize needed = [research.textField.cell cellSizeForBounds:NSMakeRect(0,0,research.textField.frame.size.width,CGFLOAT_MAX)];
        [glyphs addObject:@{@"symbol":research.symbolName ?: @"",@"saved":@(research.savedView != nil),@"titleFrame":NSStringFromRect(research.textField.frame),
          @"detailFrame":NSStringFromRect(research.detailField.frame),@"titleTextHeight":@(MIN(ceil(needed.height),35*self.host.zoom)),@"rowHeight":@(research.bounds.size.height),
          @"kindFrame":research.kindView ? NSStringFromRect(research.kindView.frame) : @"",@"savedFrame":research.savedView ? NSStringFromRect(research.savedView.frame) : @"",
          @"savedContrast":@(contrast),@"savedSelectedContrast":@(selectedContrast),@"highContrast":@(research.highContrast),
          @"emphasized":@(research.backgroundStyle == NSBackgroundStyleEmphasized),
          @"glyphsFollowSelection":@(research.backgroundStyle != NSBackgroundStyleEmphasized || [research.kindView.contentTintColor isEqual:NSColor.alternateSelectedControlTextColor]),
          @"accessibilityLabel":research.accessibilityLabel ?: @""}];
      }
      result[@"rowGlyphs"] = glyphs;
    }
    if (table.numberOfRows) result[@"rowFontSize"] = @(((NSTableCellView *)[table viewAtColumn:0 row:0 makeIfNecessary:YES]).textField.font.pointSize);
  }
  if ([self.control isKindOfClass:NSControl.class]) result[@"enabled"] = @(((NSControl *)self.control).enabled);
  if ([self.control isKindOfClass:NSScrollView.class]) { result[@"documentClass"] = NSStringFromClass(((NSScrollView *)self.control).documentView.class); result[@"scrollOrigin"] = NSStringFromPoint(((NSScrollView *)self.control).contentView.bounds.origin); result[@"documentFrame"] = NSStringFromRect(((NSScrollView *)self.control).documentView.frame); result[@"viewportSize"] = NSStringFromSize(((NSScrollView *)self.control).contentSize); }
  NSMutableArray *children = [NSMutableArray array]; for (TRNode *child in self.nodes) [children addObject:[child inspect]]; result[@"children"] = children;
  return result;
}
@end
