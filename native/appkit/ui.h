#import <AppKit/AppKit.h>
#include <node_api.h>
#include <deque>
#include <memory>
#include <string>

@class TRHost;
struct TREvent { std::string json; bool secret; bool delivered = false; __weak TRHost *host = nil; };
@class TRNode;
@interface TRCanvas : NSView
@property(nonatomic) BOOL paintsBackground;
@end

@interface TRChart : TRCanvas
@property(nonatomic, copy) NSArray<NSDictionary *> *points;
@property(nonatomic) CGFloat zoom;
@property(nonatomic) BOOL highContrast;
@property(nonatomic, strong) NSColor *accent;
- (NSArray<NSDictionary *> *)geometry;
@end

@interface TRChrome : NSObject <NSToolbarDelegate>
- (instancetype)initWithHost:(TRHost *)host;
- (void)apply:(NSDictionary *)spec;
- (void)uninstall;
- (void)fitContentView;
- (BOOL)activateFixture:(NSString *)identifier;
- (NSSearchField *)searchField:(NSString *)identifier;
- (void)searchTextChanged:(NSSearchField *)field;
- (BOOL)focusSearchField:(NSString *)identifier;
- (NSDictionary *)inspect;
@end

@interface TRPopover : NSObject <NSPopoverDelegate>
@property(nonatomic, strong) NSPopover *popover;
@property(nonatomic, strong) TRNode *node;
- (instancetype)initWithHost:(TRHost *)host;
- (void)apply:(NSDictionary *)spec;
- (void)close;
- (BOOL)suppressesTriggerFrom:(NSString *)identifier;
- (BOOL)dismissFixture:(BOOL)fromAnchor;
- (NSDictionary *)inspect;
@end

@interface TRHost : NSObject <NSWindowDelegate> {
@public
  std::deque<std::shared_ptr<TREvent>> pending;
}
@property(nonatomic, weak) NSWindow *window;
@property(nonatomic, strong) NSView *original;
@property(nonatomic, strong) TRCanvas *canvas;
@property(nonatomic, strong) TRNode *root;
@property(nonatomic, strong) NSMutableDictionary<NSString *, TRNode *> *secureFields;
@property(nonatomic, strong) NSPanel *sheet;
@property(nonatomic, strong) TRNode *modal;
@property(nonatomic, strong) TRChrome *chrome;
@property(nonatomic, strong) TRPopover *popover;
@property(nonatomic, weak) NSResponder *previousResponder;
@property(nonatomic, strong) id closeObserver;
@property(nonatomic, strong) id frameObserver;
@property(nonatomic, strong) id focusObserver;
@property(nonatomic, strong) id accessibilityObserver;
@property(nonatomic, strong) NSNumber *fixtureTransparency;
@property(nonatomic, strong) NSNumber *fixtureContrast;
/** Fixtures are instant unless a test enables animations or simulates Reduce Motion. */
@property(nonatomic) BOOL fixtureAnimations;
@property(nonatomic) BOOL fixtureReduceMotion;
/** The preference pane and heights the window was last fitted to; a user resize keeps its size. */
@property(nonatomic, copy) NSString *fittedPane;
@property(nonatomic) CGFloat fittedContent;
@property(nonatomic) CGFloat fittedChrome;
@property(nonatomic) CGFloat fittedWidth;
@property(nonatomic) CGFloat fittedFrameHeight;
@property(nonatomic) BOOL fitUserResized;
@property(nonatomic) BOOL fitAnimating;
@property(nonatomic, strong) NSColor *fixtureAccent;
@property(nonatomic) CGFloat zoom;
@property(nonatomic) BOOL fixture;
@property(nonatomic) BOOL disposed;
@property(nonatomic) NSUInteger announcementId;
@property(nonatomic) NSUInteger announcementCount;
@property(nonatomic) napi_env env;
@property(nonatomic) napi_ref regularRef;
@property(nonatomic) napi_ref secretRef;
@property(nonatomic) napi_threadsafe_function regularCallback;
- (void)mount;
- (void)present:(NSDictionary *)scene;
- (void)emit:(NSString *)action value:(id)value secret:(BOOL)secret;
- (void)flush;
- (void)ensureNativeFocus;
- (BOOL)reduceTransparency;
- (CGFloat)safeTop;
- (BOOL)increaseContrast;
/** Built-in transitions run unless Reduce Motion is on (fixtures: only when enabled). */
- (BOOL)animatesTransitions;
- (void)updateMaterials;
- (void)dispose;
- (TRNode *)find:(NSString *)identifier;
- (NSDictionary *)inspect;
- (NSSplitView *)windowSplitView;
@end

@interface TRNode : TRCanvas <NSTableViewDataSource, NSTableViewDelegate, NSTextFieldDelegate, NSTextViewDelegate, NSSplitViewDelegate>
@property(nonatomic, weak) TRHost *host;
@property(nonatomic, copy) NSDictionary *spec;
@property(nonatomic, strong) NSView *control;
@property(nonatomic, strong) TRCanvas *container;
@property(nonatomic, strong) NSArray<TRNode *> *nodes;
@property(nonatomic) BOOL applying;
@property(nonatomic) CGFloat lastWidth;
@property(nonatomic) CGFloat preferredSplit;
@property(nonatomic) CGFloat stackedFraction;
/** Window sidebar split only: lets the toolbar's tracking separator follow the divider. */
@property(nonatomic, strong) NSSplitViewController *splitController;
/** Set while the user drags or keys the divider: only then is a new width a preference. */
@property(nonatomic) BOOL userResizing;
@property(nonatomic) BOOL reconcilePending;
@property(nonatomic) BOOL animatingSplit;
@property(nonatomic) NSUInteger splitAnimation;
/** The sidebar state the latest scene asked for; the split item can lag it during animations. */
@property(nonatomic) BOOL splitTarget;
/** Inspection only: distinct sidebar widths drawn during the last show/hide animation. */
@property(nonatomic, strong) NSMutableSet<NSNumber *> *animationWidths;
@property(nonatomic) CGFloat animationFrom;
/** Inspection only: show/hide changes that ran through the animator and completed. */
@property(nonatomic) NSUInteger animationsCompleted;
/** Inspection only: width events the split has emitted (preference writes). */
@property(nonatomic) NSUInteger widthEvents;
@property(nonatomic) CGFloat reconcileAttempt;
/** Fixture only: the link a Share button would have handed to the sharing picker. */
@property(nonatomic, copy) NSString *sharedURL;
@property(nonatomic) BOOL resetScrollAfterLayout;
@property(nonatomic) BOOL revealSelection;
- (instancetype)initWithHost:(TRHost *)host spec:(NSDictionary *)spec;
- (void)update:(NSDictionary *)spec;
- (CGFloat)heightForWidth:(CGFloat)width;
/** A scroll node's document height for a content width: its children stacked, each clamped to its maxWidth. */
- (CGFloat)scrollContentHeightForWidth:(CGFloat)contentWidth;
- (CGFloat)preferredWidth;
- (TRNode *)find:(NSString *)identifier;
- (NSSplitView *)splitView;
- (void)reconcileWindowSplit;
- (void)trigger:(id)sender;
- (void)activateRow;
- (void)openRowWindow:(id)sender;
- (void)contextRow;
- (void)editChanged;
- (void)updateMaterial;
- (NSDictionary *)inspect;
@end

void TRDeliver(napi_env env, napi_value callback, const std::shared_ptr<TREvent>& event);
NSAttributedString *TRResearchText(NSString *source, NSFont *base);
NSTableCellView *TRSidebarCellView(NSDictionary *row, CGFloat zoom);
NSArray<NSDictionary *> *TRFixtureAlerts(TRHost *host);
BOOL TRActivateFixtureAlert(TRHost *host, NSString *title);
