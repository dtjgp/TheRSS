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
@property(nonatomic, weak) NSResponder *previousResponder;
@property(nonatomic, strong) id closeObserver;
@property(nonatomic, strong) id focusObserver;
@property(nonatomic, strong) id accessibilityObserver;
@property(nonatomic, strong) NSNumber *fixtureTransparency;
@property(nonatomic, strong) NSNumber *fixtureContrast;
@property(nonatomic) CGFloat zoom;
@property(nonatomic) BOOL fixture;
@property(nonatomic) BOOL disposed;
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
- (BOOL)increaseContrast;
- (void)updateMaterials;
- (void)dispose;
- (TRNode *)find:(NSString *)identifier;
- (NSDictionary *)inspect;
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
- (instancetype)initWithHost:(TRHost *)host spec:(NSDictionary *)spec;
- (void)update:(NSDictionary *)spec;
- (CGFloat)heightForWidth:(CGFloat)width;
- (CGFloat)preferredWidth;
- (TRNode *)find:(NSString *)identifier;
- (void)trigger:(id)sender;
- (void)activateRow;
- (void)contextRow;
- (void)editChanged;
- (void)updateMaterial;
- (NSDictionary *)inspect;
@end

void TRDeliver(napi_env env, napi_value callback, const std::shared_ptr<TREvent>& event);
NSAttributedString *TRResearchText(NSString *source, NSFont *base);
NSArray<NSDictionary *> *TRFixtureAlerts(TRHost *host);
BOOL TRActivateFixtureAlert(TRHost *host, NSString *title);
