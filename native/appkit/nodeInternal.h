#import "ui.h"

CGFloat TRLuminance(NSColor *color);
NSColor *TRPrimaryBackground(NSColor *accent);
CGFloat TRContrast(NSColor *first, NSColor *second);
NSColor *TRChartColor(NSColor *accent);
NSColor *TRSavedColor(BOOL highContrast);
CGFloat TRTextStyleSize(NSString *style);
NSString *TRString(id value);
CGFloat TRNumber(NSDictionary *spec, NSString *key, CGFloat fallback);

@interface TRLabel : NSTextField
@end

@interface TRButtonCell : NSButtonCell
@property(nonatomic) CGFloat leadingInset;
@end

@interface TRButton : NSButton
@property(nonatomic, copy) NSString *emphasis;
@property(nonatomic, strong) NSColor *accent;
@property(nonatomic) BOOL highContrast;
@end

@interface TRResearchCell : NSTableCellView
@property(nonatomic, strong) NSTextField *detailField;
@property(nonatomic, strong) NSImageView *kindView;
@property(nonatomic, strong) NSImageView *savedView;
@property(nonatomic, copy) NSString *symbolName;
@property(nonatomic) BOOL highContrast;
@property(nonatomic) CGFloat zoom;
@end

@interface TRDataCell : NSTableCellView
@property(nonatomic) CGFloat zoom;
@end

@interface TRTable : NSTableView
@property(nonatomic, weak) TRNode *node;
@property(nonatomic) BOOL dragged;
@end

@interface TRSplit : NSSplitView
@property(nonatomic, weak) TRNode *node;
@property(nonatomic) CGFloat initialPosition;
@end

// The window's sidebar/content split is hosted by a split view controller so AppKit can place
// the toolbar's tracking separator, and with it the window title, over the content column.
@interface TRWindowSplitController : NSSplitViewController
@property(nonatomic, weak) TRNode *node;
@end

@interface TRNode (Internal)
- (NSFont *)font;
- (NSString *)selectedRowId;
- (NSPasteboardItem *)pasteboardItemForRow:(NSInteger)row;
@end
