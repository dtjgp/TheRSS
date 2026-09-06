#import "ui.h"

static NSMutableAttributedString *TRInline(NSString *line, NSFont *base, BOOL code, NSParagraphStyle *style) {
  NSAttributedStringMarkdownParsingOptions *options = [NSAttributedStringMarkdownParsingOptions new];
  options.interpretedSyntax = NSAttributedStringMarkdownInterpretedSyntaxInlineOnlyPreservingWhitespace;
  NSMutableAttributedString *part = code ? [[NSMutableAttributedString alloc] initWithString:line] : [[[NSAttributedString alloc] initWithMarkdownString:line options:options baseURL:nil error:nil] mutableCopy];
  if (!part) part = [[NSMutableAttributedString alloc] initWithString:line];
  [part addAttributes:@{NSFontAttributeName:base, NSForegroundColorAttributeName:NSColor.labelColor, NSParagraphStyleAttributeName:style} range:NSMakeRange(0,part.length)];
  [part enumerateAttribute:NSInlinePresentationIntentAttributeName inRange:NSMakeRange(0,part.length) options:0 usingBlock:^(NSNumber *intent, NSRange range, BOOL *stop) {
    NSUInteger value = intent.unsignedIntegerValue;
    NSFont *font = (value & NSInlinePresentationIntentCode) ? [NSFont monospacedSystemFontOfSize:base.pointSize weight:NSFontWeightRegular] : base;
    if (value & NSInlinePresentationIntentStronglyEmphasized) font = [NSFontManager.sharedFontManager convertFont:font toHaveTrait:NSBoldFontMask];
    if (value & NSInlinePresentationIntentEmphasized) font = [NSFontManager.sharedFontManager convertFont:font toHaveTrait:NSItalicFontMask];
    [part addAttribute:NSFontAttributeName value:font range:range];
    if (value & NSInlinePresentationIntentStrikethrough) [part addAttribute:NSStrikethroughStyleAttributeName value:@(NSUnderlineStyleSingle) range:range];
  }];
  return part;
}

static NSArray<NSString *> *TRCells(NSString *line) {
  NSString *trimmed = [line stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceCharacterSet];
  if (![trimmed containsString:@"|"]) return nil;
  if ([trimmed hasPrefix:@"|"]) trimmed = [trimmed substringFromIndex:1];
  if ([trimmed hasSuffix:@"|"] && ![trimmed hasSuffix:@"\\|"]) trimmed = [trimmed substringToIndex:trimmed.length-1];
  NSMutableArray *cells = [NSMutableArray array]; NSMutableString *cell = [NSMutableString string];
  for (NSUInteger i = 0; i < trimmed.length; i++) {
    unichar character = [trimmed characterAtIndex:i];
    if (character == '\\' && i+1 < trimmed.length && [trimmed characterAtIndex:i+1] == '|') { [cell appendString:@"|"]; i++; }
    else if (character == '|') {
      [cells addObject:[cell stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceCharacterSet]];
      if (cells.count >= 32) return nil;
      [cell setString:@""];
    }
    else [cell appendFormat:@"%C", character];
  }
  [cells addObject:[cell stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceCharacterSet]];
  return cells;
}
static BOOL TRSeparator(NSArray<NSString *> *cells) {
  if (cells.count < 2) return NO;
  NSRegularExpression *pattern = [NSRegularExpression regularExpressionWithPattern:@"^:?-{3,}:?$" options:0 error:nil];
  for (NSString *cell in cells) if (![pattern firstMatchInString:cell options:0 range:NSMakeRange(0,cell.length)]) return NO;
  return YES;
}
static void TRAppendTable(NSMutableAttributedString *result, NSArray<NSArray<NSString *> *> *rows, NSArray<NSString *> *alignment, NSFont *base) {
  NSTextTable *table = [NSTextTable new];
  NSUInteger columns = rows.firstObject.count;
  table.numberOfColumns = columns; table.layoutAlgorithm = NSTextTableFixedLayoutAlgorithm; table.collapsesBorders = YES;
  [table setContentWidth:100 type:NSTextBlockPercentageValueType];
  for (NSUInteger row = 0; row < rows.count; row++) for (NSUInteger column = 0; column < columns; column++) {
    NSTextTableBlock *cell = [[NSTextTableBlock alloc] initWithTable:table startingRow:row rowSpan:1 startingColumn:column columnSpan:1];
    [cell setContentWidth:100.0/columns type:NSTextBlockPercentageValueType];
    [cell setWidth:6 type:NSTextBlockAbsoluteValueType forLayer:NSTextBlockPadding];
    [cell setWidth:0.5 type:NSTextBlockAbsoluteValueType forLayer:NSTextBlockBorder];
    [cell setBorderColor:NSColor.separatorColor]; cell.verticalAlignment = NSTextBlockTopAlignment;
    if (!row) cell.backgroundColor = NSColor.controlBackgroundColor;
    NSMutableParagraphStyle *style = [NSMutableParagraphStyle new]; style.textBlocks = @[cell]; style.lineSpacing = 3;
    NSString *align = column < alignment.count ? alignment[column] : @"";
    style.alignment = [align hasSuffix:@":"] ? ([align hasPrefix:@":"] ? NSTextAlignmentCenter : NSTextAlignmentRight) : NSTextAlignmentLeft;
    NSFont *font = row ? base : [NSFont boldSystemFontOfSize:base.pointSize];
    NSString *value = column < rows[row].count ? rows[row][column] : @"";
    NSMutableAttributedString *part = TRInline(value,font,NO,style);
    [part appendAttributedString:[[NSAttributedString alloc] initWithString:@"\n" attributes:@{NSFontAttributeName:font,NSParagraphStyleAttributeName:style}]];
    [result appendAttributedString:part];
  }
  [result appendAttributedString:[[NSAttributedString alloc] initWithString:@"\n" attributes:@{NSFontAttributeName:base}]];
}

// Keep block separators and explicitly map Markdown presentation intents into AppKit.
NSAttributedString *TRResearchText(NSString *source, NSFont *base) {
  NSMutableAttributedString *result = [[NSMutableAttributedString alloc] initWithString:@""];
  NSArray<NSString *> *lines = [source componentsSeparatedByString:@"\n"];
  // Bound styling work independently of the byte limit. The fallback retains all
  // source text in one attributed run, rather than allocating per-line objects.
  if (lines.count > 10000) return [[NSAttributedString alloc] initWithString:source attributes:@{NSFontAttributeName:base,NSForegroundColorAttributeName:NSColor.labelColor}];
  NSUInteger remainingCells = 4096;
  BOOL code = NO;
  for (NSUInteger index = 0; index < lines.count; index++) {
    NSString *line = lines[index];
    if ([line hasPrefix:@"```"]) { code = !code; continue; }
    NSArray *header = !code ? TRCells(line) : nil;
    NSArray *alignment = index+1 < lines.count ? TRCells(lines[index+1]) : nil;
    if (header && TRSeparator(alignment) && header.count == alignment.count) {
      NSMutableArray *rows = [NSMutableArray arrayWithObject:header]; NSUInteger end = index+2;
      BOOL valid = header.count <= 32 && header.count <= remainingCells;
      while (end < lines.count && [lines[end] containsString:@"|"]) {
        if (valid) {
          NSArray *cells = TRCells(lines[end]);
          valid = cells.count == header.count && (rows.count+1)*header.count <= remainingCells;
          if (valid) [rows addObject:cells];
        }
        end++;
      }
      if (valid) { remainingCells -= rows.count*header.count; TRAppendTable(result,rows,alignment,base); }
      else {
        // Ragged or oversized tables are literal text, never a padded Cartesian
        // product of their largest row and row count.
        NSString *literal = [[lines subarrayWithRange:NSMakeRange(index,end-index)] componentsJoinedByString:@"\n"];
        [result appendAttributedString:[[NSAttributedString alloc] initWithString:[literal stringByAppendingString:@"\n"] attributes:@{NSFontAttributeName:base,NSForegroundColorAttributeName:NSColor.labelColor}]];
      }
      index = end-1; continue;
    }
    NSUInteger heading = 0;
    while (!code && heading < line.length && heading < 6 && [line characterAtIndex:heading] == '#') heading++;
    if (heading && line.length > heading && [line characterAtIndex:heading] == ' ') line = [line substringFromIndex:heading+1]; else heading = 0;
    BOOL bullet = !code && ([line hasPrefix:@"- "] || [line hasPrefix:@"* "]);
    if (bullet) line = [@"• " stringByAppendingString:[line substringFromIndex:2]];
    NSFont *font = code ? [NSFont monospacedSystemFontOfSize:base.pointSize-1 weight:NSFontWeightRegular] : heading ? [NSFont boldSystemFontOfSize:base.pointSize+MAX(1,5-(NSInteger)heading)] : base;
    NSMutableParagraphStyle *style = [NSMutableParagraphStyle new]; style.lineSpacing = 3; style.paragraphSpacing = heading ? 7 : 3;
    if (bullet) style.headIndent = 16;
    [result appendAttributedString:TRInline(line,font,code,style)];
    [result appendAttributedString:[[NSAttributedString alloc] initWithString:@"\n" attributes:@{NSFontAttributeName:font,NSParagraphStyleAttributeName:style}]];
  }
  return result;
}
