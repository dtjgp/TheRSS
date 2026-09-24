#import "ui.h"

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
}
- (NSArray<NSToolbarItemIdentifier> *)identifiers {
  NSMutableArray *leading = [NSMutableArray array], *trailing = [NSMutableArray array];
  for (NSDictionary *item in _items) [[item[@"placement"] isEqual:@"sidebar"] ? leading : trailing addObject:item[@"id"]];
  // NSTrackingSeparatorToolbarItem requires an NSSplitViewController delegate (the S1 spike
  // crashed with the TRSplit delegate), so sidebar items lead and a flexible space follows.
  NSMutableArray *result = [leading mutableCopy];
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
  if (!window.toolbar || window.toolbar == _previousToolbar || ![signature isEqual:_signature]) {
    _signature = signature;
    NSToolbar *toolbar = [[NSToolbar alloc] initWithIdentifier:[NSString stringWithFormat:@"therss.window.%lu",(unsigned long)++_generation]];
    toolbar.delegate = self; toolbar.displayMode = NSToolbarDisplayModeIconOnly;
    toolbar.allowsUserCustomization = NO; toolbar.autosavesConfiguration = NO;
    window.toolbar = toolbar;
  } else for (NSToolbarItem *item in window.toolbar.items) [self configure:item];
}
- (NSDictionary *)specFor:(NSString *)identifier {
  for (NSDictionary *item in _items) if ([item[@"id"] isEqual:identifier]) return item;
  return nil;
}
- (void)configure:(NSToolbarItem *)item {
  NSDictionary *spec = [self specFor:item.itemIdentifier]; if (!spec) return;
  item.label = spec[@"title"]; item.paletteLabel = spec[@"title"];
  item.toolTip = spec[@"help"] ?: spec[@"title"];
  item.image = [NSImage imageWithSystemSymbolName:spec[@"symbol"] accessibilityDescription:spec[@"title"]];
  item.autovalidates = NO; item.enabled = spec[@"enabled"] ? [spec[@"enabled"] boolValue] : YES;
}
- (NSToolbarItem *)toolbar:(NSToolbar *)toolbar itemForItemIdentifier:(NSToolbarItemIdentifier)identifier willBeInsertedIntoToolbar:(BOOL)flag {
  if (![self specFor:identifier]) return nil;
  NSToolbarItem *item = [[NSToolbarItem alloc] initWithItemIdentifier:identifier];
  item.bordered = YES; item.target = self; item.action = @selector(activate:);
  // Navigational items lead the title, where Finder and Mail keep the sidebar toggle.
  item.navigational = [[self specFor:identifier][@"placement"] isEqual:@"sidebar"];
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
- (BOOL)activateFixture:(NSString *)identifier {
  for (NSToolbarItem *item in _host.window.toolbar.items) if ([item.itemIdentifier isEqual:identifier] && item.enabled) { [self activate:item]; return YES; }
  return NO;
}
- (NSDictionary *)inspect {
  NSWindow *window = _host.window; NSMutableArray *items = [NSMutableArray array];
  for (NSToolbarItem *item in window.toolbar.items)
    [items addObject:@{@"id":item.itemIdentifier,@"label":item.label ?: @"",@"enabled":@(item.enabled),@"bordered":@(item.bordered),@"hasImage":@(item.image != nil)}];
  NSButton *close = [window standardWindowButton:NSWindowCloseButton];
  NSRect closeFrame = close ? [close convertRect:close.bounds toView:nil] : NSZeroRect;
  return @{@"installed":@(_installed),@"title":window.title ?: @"",@"titleVisible":@(window.titleVisibility == NSWindowTitleVisible),
           @"style":window.toolbarStyle == NSWindowToolbarStyleUnified ? @"unified" : @"other",
           @"fullSizeContent":@((window.styleMask & NSWindowStyleMaskFullSizeContentView) != 0),
           @"safeTop":@([_host safeTop]),@"closeButtonFrame":NSStringFromRect(closeFrame),
           @"windowHeight":@(window.frame.size.height),@"contentFrame":NSStringFromRect(window.contentView.frame),
           @"frameViewBounds":NSStringFromRect(window.contentView.superview.bounds),@"layoutRect":NSStringFromRect(window.contentLayoutRect),
           @"contentRectForFrame":NSStringFromRect([window contentRectForFrameRect:window.frame]),@"windowClass":NSStringFromClass(window.class),@"items":items};
}
@end
