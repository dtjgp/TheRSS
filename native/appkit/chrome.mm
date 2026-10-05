#import "ui.h"

static NSToolbarItemIdentifier const TRSidebarSeparator = @"therss.sidebar-separator";

// Window chrome for the AppKit route: a unified NSToolbar over a full-size content view.
// Items and their actions come only from the validated scene `toolbar`; AppKit owns the
// title, traffic lights and toolbar layout.

@interface TRSidebarCell : NSTableCellView
@property(nonatomic) CGFloat zoom;
@end
@implementation TRSidebarCell
- (void)layout {
  [super layout];
  CGFloat height = self.bounds.size.height, icon = 18*self.zoom, inset = 6*self.zoom;
  self.imageView.frame = NSMakeRect(inset,(height-icon)/2,icon,icon);
  CGFloat x = inset+icon+8*self.zoom, textHeight = ceil(self.textField.intrinsicContentSize.height);
  self.textField.frame = NSMakeRect(x,(height-textHeight)/2,MAX(20,self.bounds.size.width-x-inset),textHeight);
}
@end

NSTableCellView *TRSidebarCellView(NSDictionary *row, CGFloat zoom) {
  TRSidebarCell *cell = [TRSidebarCell new]; cell.zoom = zoom;
  NSString *title = [row[@"title"] isKindOfClass:NSString.class] ? row[@"title"] : @"";
  NSImageView *image = [NSImageView new];
  if ([row[@"symbol"] isKindOfClass:NSString.class]) image.image = [NSImage imageWithSystemSymbolName:row[@"symbol"] accessibilityDescription:nil];
  image.symbolConfiguration = [NSImageSymbolConfiguration configurationWithPointSize:14*zoom weight:NSFontWeightRegular];
  image.contentTintColor = NSColor.controlAccentColor;
  NSTextField *label = [NSTextField labelWithString:title];
  label.font = [NSFont systemFontOfSize:13*zoom]; label.lineBreakMode = NSLineBreakByTruncatingTail;
  [cell addSubview:image]; [cell addSubview:label]; cell.imageView = image; cell.textField = label;
  cell.accessibilityLabel = title;
  return cell;
}

@implementation TRChrome {
  __weak TRHost *_host;
  NSArray<NSDictionary *> *_items;
  NSString *_signature;
  NSUInteger _generation;
  BOOL _installed;
  NSWindowStyleMask _styleMask;
  NSWindowTitleVisibility _titleVisibility;
  NSWindowToolbarStyle _toolbarStyle;
  BOOL _transparentTitlebar;
  NSToolbar *_previousToolbar;
}
- (instancetype)initWithHost:(TRHost *)host { self = [super init]; if (self) _host = host; return self; }
- (void)install {
  NSWindow *window = _host.window; if (_installed || !window) return;
  _installed = YES;
  _styleMask = window.styleMask; _titleVisibility = window.titleVisibility; _toolbarStyle = window.toolbarStyle;
  _transparentTitlebar = window.titlebarAppearsTransparent; _previousToolbar = window.toolbar;
  window.styleMask |= NSWindowStyleMaskFullSizeContentView;
  window.titleVisibility = NSWindowTitleVisible;
  window.titlebarAppearsTransparent = NO;
  window.toolbarStyle = NSWindowToolbarStyleUnified;
  [self fitContentView];
}
- (void)fitContentView {
  // Electron's window bridge re-applies its cached titled content size (S1 spike: an 816 pt
  // content view inside an 848 pt full-size window after show). Keep the content view equal
  // to the frame view while the full-size chrome is installed.
  NSWindow *window = _host.window; NSView *frameView = window.contentView.superview;
  if (!_installed || !frameView || NSEqualRects(window.contentView.frame,frameView.bounds)) return;
  window.contentView.frame = frameView.bounds;
}
- (void)uninstall {
  NSWindow *window = _host.window; if (!_installed || !window) return;
  _installed = NO;
  window.toolbar = _previousToolbar; window.toolbarStyle = _toolbarStyle;
  window.titleVisibility = _titleVisibility; window.titlebarAppearsTransparent = _transparentTitlebar;
  window.styleMask = _styleMask; _previousToolbar = nil;
  [NSNotificationCenter.defaultCenter removeObserver:self name:NSControlTextDidChangeNotification object:nil];
}
- (NSArray<NSToolbarItemIdentifier> *)identifiers {
  NSMutableArray *leading = [NSMutableArray array], *trailing = [NSMutableArray array];
  for (NSDictionary *item in _items) [[item[@"placement"] isEqual:@"sidebar"] ? leading : trailing addObject:item[@"id"]];
  // With the window split hosted by a split view controller, a tracking separator follows the
  // sidebar divider; AppKit then draws the title over the content column, as in Mail.
  NSMutableArray *result = [leading mutableCopy];
  if ([_host windowSplitView]) [result addObject:TRSidebarSeparator];
  [result addObject:NSToolbarFlexibleSpaceItemIdentifier];
  [result addObjectsFromArray:trailing];
  return result;
}
- (void)apply:(NSDictionary *)spec {
  NSWindow *window = _host.window; if (!window || ![spec isKindOfClass:NSDictionary.class]) return;
  [self install];
  NSString *title = [spec[@"title"] isKindOfClass:NSString.class] ? spec[@"title"] : @"TheRSS";
  if (![window.title isEqual:title]) window.title = title;
  _items = [spec[@"items"] isKindOfClass:NSArray.class] ? spec[@"items"] : @[];
  NSString *signature = [[self identifiers] componentsJoinedByString:@"|"];
  if (!window.toolbar || window.toolbar == _previousToolbar) {
    _signature = signature;
    NSToolbar *toolbar = [[NSToolbar alloc] initWithIdentifier:[NSString stringWithFormat:@"therss.window.%lu",(unsigned long)++_generation]];
    toolbar.delegate = self; toolbar.displayMode = NSToolbarDisplayModeIconOnly;
    toolbar.allowsUserCustomization = NO; toolbar.autosavesConfiguration = NO;
    window.toolbar = toolbar;
    return;
  }
  if (![signature isEqual:_signature]) {
    // Insert and remove items in place: replacing the toolbar would recreate the search field
    // and drop its text, caret and IME composition.
    _signature = signature;
    NSToolbar *toolbar = window.toolbar; NSArray<NSToolbarItemIdentifier> *wanted = [self identifiers];
    for (NSInteger index = (NSInteger)toolbar.items.count - 1; index >= 0; index--)
      if (![wanted containsObject:toolbar.items[index].itemIdentifier]) [toolbar removeItemAtIndex:index];
    for (NSUInteger index = 0; index < wanted.count; index++)
      if (index >= toolbar.items.count || ![toolbar.items[index].itemIdentifier isEqual:wanted[index]])
        [toolbar insertItemWithItemIdentifier:wanted[index] atIndex:index];
  }
  // A replaced window split needs a fresh tracking separator (the item retains its split view).
  NSSplitView *split = [_host windowSplitView];
  for (NSInteger index = (NSInteger)window.toolbar.items.count - 1; index >= 0; index--) {
    NSToolbarItem *item = window.toolbar.items[index];
    if ([item isKindOfClass:NSTrackingSeparatorToolbarItem.class] && ((NSTrackingSeparatorToolbarItem *)item).splitView != split) {
      [window.toolbar removeItemAtIndex:index]; [window.toolbar insertItemWithItemIdentifier:TRSidebarSeparator atIndex:index];
    }
  }
  for (NSToolbarItem *item in window.toolbar.items) [self configure:item];
}
- (NSDictionary *)specFor:(NSString *)identifier {
  for (NSDictionary *item in _items) if ([item[@"id"] isEqual:identifier]) return item;
  return nil;
}
- (void)configure:(NSToolbarItem *)item {
  NSDictionary *spec = [self specFor:item.itemIdentifier]; if (!spec) return;
  if ([item isKindOfClass:NSSearchToolbarItem.class]) {
    NSSearchField *field = ((NSSearchToolbarItem *)item).searchField;
    item.label = spec[@"title"]; item.paletteLabel = spec[@"title"]; item.toolTip = spec[@"help"] ?: spec[@"title"];
    field.placeholderString = spec[@"placeholder"]; field.accessibilityLabel = spec[@"title"];
    // Scene values never replace text the user is editing (including IME composition).
    NSString *value = [spec[@"value"] isKindOfClass:NSString.class] ? spec[@"value"] : @"";
    if (!field.currentEditor && ![field.stringValue isEqual:value]) field.stringValue = value;
    return;
  }
  item.label = spec[@"title"]; item.paletteLabel = spec[@"title"];
  item.toolTip = spec[@"help"] ?: spec[@"title"];
  item.image = [NSImage imageWithSystemSymbolName:spec[@"symbol"] accessibilityDescription:spec[@"title"]];
  item.autovalidates = NO; item.enabled = spec[@"enabled"] ? [spec[@"enabled"] boolValue] : YES;
}
- (NSToolbarItem *)toolbar:(NSToolbar *)toolbar itemForItemIdentifier:(NSToolbarItemIdentifier)identifier willBeInsertedIntoToolbar:(BOOL)flag {
  if ([identifier isEqual:TRSidebarSeparator]) {
    NSSplitView *split = [_host windowSplitView];
    return split ? [NSTrackingSeparatorToolbarItem trackingSeparatorToolbarItemWithIdentifier:identifier splitView:split dividerIndex:0] : nil;
  }
  NSDictionary *spec = [self specFor:identifier]; if (!spec) return nil;
  if ([spec[@"kind"] isEqual:@"search"]) {
    NSSearchToolbarItem *search = [[NSSearchToolbarItem alloc] initWithItemIdentifier:identifier];
    NSSearchField *field = search.searchField;
    // Observe text changes by notification: NSSearchToolbarItem may manage the field's delegate
    // during search interaction, and a lost delegate callback would drop typed queries.
    field.target = self; field.action = @selector(searchActivated:);
    [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(searchFieldTextDidChange:) name:NSControlTextDidChangeNotification object:field];
    field.sendsWholeSearchString = YES; field.sendsSearchStringImmediately = NO;
    // Only Return, the clear button and Escape send the action. Ending an edit (focus moving)
    // must not: the field editor is already detached and would report an empty query.
    field.cell.sendsActionOnEndEditing = NO;
    [self configure:search];
    return search;
  }
  NSToolbarItem *item = [[NSToolbarItem alloc] initWithItemIdentifier:identifier];
  item.bordered = YES; item.target = self; item.action = @selector(activate:);
  // Sidebar items sit in the sidebar section before the tracking separator, as in Mail and
  // Notes; without a window split they fall back to leading the title as navigational items.
  item.navigational = [[self specFor:identifier][@"placement"] isEqual:@"sidebar"] && ![_host windowSplitView];
  [self configure:item];
  return item;
}
- (NSArray<NSToolbarItemIdentifier> *)toolbarDefaultItemIdentifiers:(NSToolbar *)toolbar { return [self identifiers]; }
- (NSArray<NSToolbarItemIdentifier> *)toolbarAllowedItemIdentifiers:(NSToolbar *)toolbar { return [self identifiers]; }
- (void)activate:(NSToolbarItem *)sender {
  NSDictionary *spec = [self specFor:sender.itemIdentifier];
  if (!spec || !sender.enabled || _host.sheet) return;
  [_host emit:spec[@"action"] value:nil secret:NO];
}
- (NSSearchField *)searchField:(NSString *)identifier {
  for (NSToolbarItem *item in _host.window.toolbar.items)
    if ([item isKindOfClass:NSSearchToolbarItem.class] && [item.itemIdentifier isEqual:identifier]) return ((NSSearchToolbarItem *)item).searchField;
  return nil;
}
- (NSDictionary *)specForField:(NSSearchField *)field {
  for (NSToolbarItem *item in _host.window.toolbar.items)
    if ([item isKindOfClass:NSSearchToolbarItem.class] && ((NSSearchToolbarItem *)item).searchField == field) return [self specFor:item.itemIdentifier];
  return nil;
}
- (void)searchTextChanged:(NSSearchField *)field {
  NSDictionary *spec = [self specForField:field];
  // Composition (marked text) is not a query yet; search once it is committed.
  if (!spec || [(NSTextView *)field.currentEditor hasMarkedText]) return;
  // While editing, the field editor holds the live text; stringValue can still be the last
  // committed value (plain workflow run: an edited field emitted '' and cleared the search).
  NSString *text = field.currentEditor ? ((NSTextView *)field.currentEditor).string : field.stringValue;
  NSString *value = text.length > 200 ? [text substringToIndex:200] : text;
  [_host emit:spec[@"action"] value:value secret:NO];
}
- (void)searchFieldTextDidChange:(NSNotification *)notification {
  if ([notification.object isKindOfClass:NSSearchField.class]) [self searchTextChanged:notification.object];
}
- (void)searchActivated:(NSSearchField *)field {
  NSDictionary *spec = [self specForField:field]; if (!spec || _host.sheet) return;
  // An empty whole-string action is the clear button or Escape; otherwise Return. Read the live
  // editor text: stringValue can lag while editing and would clear a just-typed query.
  NSString *text = field.currentEditor ? ((NSTextView *)field.currentEditor).string : field.stringValue;
  if (text.length) [_host emit:spec[@"activate"] value:nil secret:NO];
  else [_host emit:spec[@"action"] value:@"" secret:NO];
}
- (BOOL)focusSearchField:(NSString *)identifier {
  for (NSToolbarItem *item in _host.window.toolbar.items)
    if ([item isKindOfClass:NSSearchToolbarItem.class] && [item.itemIdentifier isEqual:identifier]) {
      NSSearchField *field = ((NSSearchToolbarItem *)item).searchField;
      // A field that is already editing keeps its editor; re-focusing would end the edit.
      if (field.currentEditor && _host.window.firstResponder == field.currentEditor) return YES;
      [(NSSearchToolbarItem *)item beginSearchInteraction];
      [_host.window makeFirstResponder:field];
      return YES;
    }
  return NO;
}
- (BOOL)activateFixture:(NSString *)identifier {
  for (NSToolbarItem *item in _host.window.toolbar.items) if ([item.itemIdentifier isEqual:identifier] && item.enabled) { [self activate:item]; return YES; }
  return NO;
}
- (NSDictionary *)inspect {
  NSWindow *window = _host.window; NSMutableArray *items = [NSMutableArray array];
  for (NSToolbarItem *item in window.toolbar.items) {
    NSMutableDictionary *entry = [@{@"id":item.itemIdentifier,@"label":item.label ?: @"",@"enabled":@(item.enabled),@"bordered":@(item.bordered),@"hasImage":@(item.image != nil)} mutableCopy];
    if ([item isKindOfClass:NSSearchToolbarItem.class]) {
      NSSearchField *field = ((NSSearchToolbarItem *)item).searchField;
      entry[@"kind"] = @"search"; entry[@"value"] = field.stringValue ?: @""; entry[@"placeholder"] = field.placeholderString ?: @"";
      entry[@"editing"] = @(field.currentEditor != nil && window.firstResponder == field.currentEditor);
      entry[@"marked"] = @([(NSTextView *)field.currentEditor hasMarkedText]);
      entry[@"instance"] = [NSString stringWithFormat:@"%p",field];
    }
    [items addObject:entry];
  }
  NSButton *close = [window standardWindowButton:NSWindowCloseButton];
  NSRect closeFrame = close ? [close convertRect:close.bounds toView:nil] : NSZeroRect;
  // Where AppKit draws the title, and where the sidebar divider is, in window coordinates.
  __block NSRect titleFrame = NSZeroRect;
  NSMutableArray<NSView *> *views = [NSMutableArray arrayWithObject:window.contentView.superview ?: window.contentView];
  for (NSUInteger i = 0; i < views.count && NSIsEmptyRect(titleFrame); i++) {
    NSView *view = views[i];
    if (view == window.contentView) continue;
    if ([view isKindOfClass:NSTextField.class] && [((NSTextField *)view).stringValue isEqual:window.title] && !view.isHiddenOrHasHiddenAncestor) titleFrame = [view convertRect:view.bounds toView:nil];
    else [views addObjectsFromArray:view.subviews];
  }
  NSSplitView *split = [_host windowSplitView];
  NSView *sidebarPane = split.arrangedSubviews.firstObject;
  CGFloat divider = sidebarPane && !sidebarPane.isHidden ? NSMaxX([sidebarPane convertRect:sidebarPane.bounds toView:nil]) : 0;
  BOOL separator = NO; for (NSToolbarItem *item in window.toolbar.items) if ([item isKindOfClass:NSTrackingSeparatorToolbarItem.class]) separator = YES;
  return @{@"installed":@(_installed),@"title":window.title ?: @"",@"titleFrame":NSStringFromRect(titleFrame),@"sidebarDivider":@(divider),@"trackingSeparator":@(separator),@"titleVisible":@(window.titleVisibility == NSWindowTitleVisible),
           @"style":window.toolbarStyle == NSWindowToolbarStyleUnified ? @"unified" : @"other",
           @"fullSizeContent":@((window.styleMask & NSWindowStyleMaskFullSizeContentView) != 0),
           @"safeTop":@([_host safeTop]),@"closeButtonFrame":NSStringFromRect(closeFrame),
           @"windowHeight":@(window.frame.size.height),@"contentFrame":NSStringFromRect(window.contentView.frame),
           @"frameViewBounds":NSStringFromRect(window.contentView.superview.bounds),@"layoutRect":NSStringFromRect(window.contentLayoutRect),
           @"contentRectForFrame":NSStringFromRect([window contentRectForFrameRect:window.frame]),@"windowClass":NSStringFromClass(window.class),@"items":items};
}
@end
