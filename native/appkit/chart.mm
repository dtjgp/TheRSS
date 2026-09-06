#import "ui.h"

@implementation TRChart
- (NSArray<NSDictionary *> *)geometry {
  CGFloat left = 44*self.zoom, top = 24*self.zoom;
  CGFloat width = MAX(0,self.bounds.size.width-left-16*self.zoom);
  CGFloat height = MAX(0,self.bounds.size.height-top-28*self.zoom);
  CGFloat maximum = 0;
  for (NSDictionary *point in self.points) maximum = MAX(maximum,[point[@"value"] doubleValue]);
  CGFloat step = width/MAX(1,self.points.count), barWidth = MIN(32*self.zoom,step*0.48);
  NSMutableArray *bars = [NSMutableArray array];
  for (NSUInteger index = 0; index < self.points.count; index++) {
    NSDictionary *point = self.points[index];
    CGFloat extent = maximum > 0 ? height*[point[@"value"] doubleValue]/maximum : 0;
    NSRect frame = NSMakeRect(left+step*(index+0.5)-barWidth/2,top+height-extent,barWidth,extent);
    [bars addObject:@{@"date":point[@"date"],@"value":point[@"value"],@"frame":NSStringFromRect(frame)}];
  }
  return bars;
}
- (void)drawRect:(NSRect)rect {
  [super drawRect:rect];
  CGFloat left = 44*self.zoom, top = 24*self.zoom, bottom = self.bounds.size.height-28*self.zoom;
  CGFloat right = self.bounds.size.width-16*self.zoom;
  if (right <= left || bottom <= top || !self.points.count) return;
  CGFloat maximum = 0;
  for (NSDictionary *point in self.points) maximum = MAX(maximum,[point[@"value"] doubleValue]);
  NSDictionary *attributes = @{NSFontAttributeName:[NSFont systemFontOfSize:10*self.zoom],NSForegroundColorAttributeName:self.highContrast ? NSColor.labelColor : NSColor.secondaryLabelColor};
  NSBezierPath *grid = [NSBezierPath bezierPath];
  for (NSUInteger line = 0; line <= 2; line++) {
    CGFloat y = top+(bottom-top)*line/2;
    [grid moveToPoint:NSMakePoint(left,y)]; [grid lineToPoint:NSMakePoint(right,y)];
  }
  [(self.highContrast ? NSColor.labelColor : NSColor.separatorColor) setStroke]; grid.lineWidth = self.highContrast ? 1 : 0.5; [grid stroke];
  NSString *peak = [NSString stringWithFormat:@"%.0f",maximum];
  [peak drawAtPoint:NSMakePoint(MAX(0,left-[peak sizeWithAttributes:attributes].width-7*self.zoom),top-6*self.zoom) withAttributes:attributes];
  [@"0" drawAtPoint:NSMakePoint(left-14*self.zoom,bottom-6*self.zoom) withAttributes:attributes];
  NSUInteger labelStep = MAX(1,(self.points.count+6)/7);
  NSArray *bars = [self geometry];
  CGFloat step = (right-left)/self.points.count;
  for (NSUInteger index = 0; index < bars.count; index++) {
    NSDictionary *bar = bars[index]; NSRect frame = NSRectFromString(bar[@"frame"]);
    if (frame.size.height > 0) {
      [self.accent setFill]; [[NSBezierPath bezierPathWithRoundedRect:frame xRadius:MIN(3*self.zoom,frame.size.height/2) yRadius:MIN(3*self.zoom,frame.size.height/2)] fill];
      if (self.highContrast) { [NSColor.labelColor setStroke]; [NSBezierPath strokeRect:frame]; }
    }
    CGFloat center = NSMidX(frame);
    NSString *value = [bar[@"value"] stringValue];
    NSSize size = [value sizeWithAttributes:attributes];
    if (bars.count <= 14 && size.width < step) [value drawAtPoint:NSMakePoint(center-size.width/2,frame.origin.y-16*self.zoom) withAttributes:attributes];
    if (index % labelStep == 0 || index == bars.count-1) {
      NSString *date = bar[@"date"]; if (date.length >= 10) date = [date substringFromIndex:5];
      NSSize dateSize = [date sizeWithAttributes:attributes];
      [date drawAtPoint:NSMakePoint(center-dateSize.width/2,bottom+7*self.zoom) withAttributes:attributes];
    }
  }
}
@end
