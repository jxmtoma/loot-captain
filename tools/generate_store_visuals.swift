import AppKit
import ImageIO

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath).standardizedFileURL
let iconDirectory = root.appendingPathComponent("icons")
let realSiteAssets = root.appendingPathComponent("tools/real-site")
let storeAssets = root.appendingPathComponent("store-assets")
let docsAssets = root.appendingPathComponent("docs/assets")

func color(_ hex: String, alpha: CGFloat = 1) -> NSColor {
    let value = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    var number: UInt64 = 0
    Scanner(string: value).scanHexInt64(&number)
    return NSColor(calibratedRed: CGFloat((number >> 16) & 255) / 255, green: CGFloat((number >> 8) & 255) / 255, blue: CGFloat(number & 255) / 255, alpha: alpha)
}

func drawRect(_ rect: NSRect, fill: NSColor, stroke: NSColor? = nil, radius: CGFloat = 0, lineWidth: CGFloat = 1) {
    let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
    fill.setFill()
    path.fill()
    if let stroke {
        stroke.setStroke()
        path.lineWidth = lineWidth
        path.stroke()
    }
}

func drawLine(_ start: NSPoint, _ end: NSPoint, color: NSColor, width: CGFloat = 1) {
    let path = NSBezierPath()
    path.move(to: start)
    path.line(to: end)
    path.lineWidth = width
    color.setStroke()
    path.stroke()
}

func drawLootCaptainMark(_ rect: NSRect) {
    let x = rect.minX
    let y = rect.minY
    let w = rect.width
    let h = rect.height
    drawRect(rect, fill: color("#07110f"), stroke: color("#3d2c13"), radius: w * 0.16, lineWidth: max(1, w * 0.04))
    drawRect(NSRect(x: x + w * 0.05, y: y + h * 0.05, width: w * 0.9, height: h * 0.9), fill: color("#142a24"), stroke: color("#d2ad5e"), radius: w * 0.13, lineWidth: max(1, w * 0.03))
    drawRect(NSRect(x: x + w * 0.1, y: y + h * 0.1, width: w * 0.8, height: h * 0.8), fill: color("#091713"), stroke: color("#6f5228"), radius: w * 0.09, lineWidth: max(1, w * 0.015))

    let shield = NSBezierPath()
    shield.move(to: NSPoint(x: x + w * 0.5, y: y + h * 0.16))
    for point in [(0.79, 0.28), (0.74, 0.72), (0.5, 0.9), (0.26, 0.72), (0.21, 0.28)] {
        shield.line(to: NSPoint(x: x + w * point.0, y: y + h * point.1))
    }
    shield.close()
    NSGradient(starting: color("#277b67"), ending: color("#0b3029"))?.draw(in: shield, angle: -90)
    color("#d2ad5e").setStroke()
    shield.lineWidth = max(1, w * 0.03)
    shield.stroke()

    let crown = NSBezierPath()
    crown.move(to: NSPoint(x: x + w * 0.34, y: y + h * 0.54))
    for point in [(0.31, 0.36), (0.45, 0.45), (0.5, 0.27), (0.57, 0.45), (0.7, 0.35), (0.66, 0.54)] {
        crown.line(to: NSPoint(x: x + w * point.0, y: y + h * point.1))
    }
    crown.close()
    NSGradient(starting: color("#f0d486"), ending: color("#9b682d"))?.draw(in: crown, angle: -90)
    color("#69451d").setStroke()
    crown.lineWidth = max(1, w * 0.02)
    crown.stroke()
    drawRect(NSRect(x: x + w * 0.35, y: y + h * 0.54, width: w * 0.3, height: h * 0.1), fill: color("#c99443"), stroke: color("#69451d"), radius: w * 0.01, lineWidth: max(1, w * 0.02))
}

func drawText(_ value: String, x: CGFloat, y: CGFloat, size: CGFloat, fill: NSColor, bold: Bool = false, serif: Bool = false, align: NSTextAlignment = .left) {
    let family = serif ? (bold ? "Georgia-Bold" : "Georgia") : (bold ? "Arial-BoldMT" : "Arial")
    let font = NSFont(name: family, size: size) ?? NSFont.systemFont(ofSize: size, weight: bold ? .bold : .regular)
    let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: fill]
    let string = value as NSString
    let textSize = string.size(withAttributes: attributes)
    let offset: CGFloat = align == .center ? textSize.width / 2 : align == .right ? textSize.width : 0
    string.draw(at: NSPoint(x: x - offset, y: y), withAttributes: attributes)
}

func drawIcon(_ rect: NSRect) {
    drawLootCaptainMark(rect)
}

func drawSourceImage(_ name: String, rect: NSRect) {
    guard let image = NSImage(contentsOf: realSiteAssets.appendingPathComponent(name)) else { return }
    image.draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
}

func newImage(width: CGFloat, height: CGFloat, draw: () -> Void) -> NSImage {
    let image = NSImage(size: NSSize(width: width, height: height))
    image.lockFocusFlipped(true)
    draw()
    image.unlockFocus()
    return image
}

func save(_ image: NSImage, as name: String, directory: URL = storeAssets, alsoCopyTo: URL? = nil) {
    var rect = NSRect.zero
    guard let cgImage = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else { return }
    let width = Int(image.size.width)
    let height = Int(image.size.height)
    guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                                  space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return }
    context.interpolationQuality = .high
    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
    guard let output = context.makeImage() else { return }
    assert(output.width == width && output.height == height)
    let destination = directory.appendingPathComponent(name)
    let url = destination as CFURL
    guard let writer = CGImageDestinationCreateWithURL(url, "public.png" as CFString, 1, nil) else { return }
    CGImageDestinationAddImage(writer, output, nil)
    CGImageDestinationFinalize(writer)
    if let alsoCopyTo {
        try? FileManager.default.createDirectory(at: alsoCopyTo.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? FileManager.default.removeItem(at: alsoCopyTo)
        try? FileManager.default.copyItem(at: destination, to: alsoCopyTo)
    }
}

struct Slot { let label: String; let column: Int; let row: Int }
let slots = [
    Slot(label: "Left Ear", column: 2, row: 1), Slot(label: "Head", column: 3, row: 1), Slot(label: "Face", column: 4, row: 1), Slot(label: "Right Ear", column: 5, row: 1),
    Slot(label: "Neck", column: 6, row: 2), Slot(label: "Back", column: 6, row: 3), Slot(label: "Shoulder", column: 6, row: 4), Slot(label: "Right Wrist", column: 6, row: 5),
    Slot(label: "Feet", column: 5, row: 6), Slot(label: "Charm", column: 4, row: 6), Slot(label: "Hand", column: 3, row: 6), Slot(label: "Leg", column: 2, row: 6),
    Slot(label: "Left Wrist", column: 1, row: 5), Slot(label: "Waist", column: 1, row: 4), Slot(label: "Arm", column: 1, row: 3), Slot(label: "Chest", column: 1, row: 2),
    Slot(label: "Finger 1", column: 2, row: 7), Slot(label: "Finger 2", column: 3, row: 7), Slot(label: "Power Source", column: 4, row: 7),
    Slot(label: "Primary", column: 2, row: 8), Slot(label: "Secondary", column: 3, row: 8), Slot(label: "Range", column: 4, row: 8),
]
let filled = Set(["Head", "Face", "Neck", "Back", "Shoulder", "Right Wrist", "Feet", "Charm", "Hand", "Leg", "Left Wrist", "Waist", "Arm", "Chest", "Finger 1", "Finger 2", "Primary", "Secondary", "Range"])

func drawInventoryPreview(x: CGFloat, y: CGFloat, width: CGFloat, height: CGFloat, compact: Bool = false) {
    let navy = color("#0b1523")
    let lineColor = color("#53677f")
    let gold = color("#f0d381")
    drawRect(NSRect(x: x, y: y, width: width, height: height), fill: navy, stroke: lineColor, radius: 8, lineWidth: 2)
    drawText("EQUIPMENT", x: x + 18, y: y + 14, size: compact ? 13 : 15, fill: gold, bold: true, serif: true)
    drawLine(NSPoint(x: x + 16, y: y + 42), NSPoint(x: x + width - 16, y: y + 42), color: color("#8e713d"))
    let gridX = x + 18
    let gridY = y + 54
    let gap: CGFloat = 4
    let columnWidth = (width - 36 - gap * 5) / 6
    let rowHeight = (height - 72 - gap * 7) / 8
    for slot in slots {
        let sx = gridX + CGFloat(slot.column - 1) * (columnWidth + gap)
        let sy = gridY + CGFloat(slot.row - 1) * (rowHeight + gap)
        let active = filled.contains(slot.label)
        drawRect(NSRect(x: sx, y: sy, width: columnWidth, height: rowHeight), fill: color("#17263a"), stroke: color(active ? "#a0834b" : "#52657d"), radius: 4)
        if active {
            drawRect(NSRect(x: sx + 5, y: sy + 5, width: min(25, rowHeight - 10), height: min(25, rowHeight - 10)), fill: color("#151a27"), stroke: color("#b18c4b"), radius: 3)
        }
        drawText(slot.label, x: sx + 35, y: sy + rowHeight / 2 - (compact ? 5 : 4), size: compact ? 9 : 10, fill: color(active ? "#f0dfad" : "#9eabb9"), bold: active)
    }
    let centerX = gridX + 2 * (columnWidth + gap)
    let centerY = gridY + rowHeight + gap
    let centerWidth = 2 * columnWidth + gap
    let centerHeight = 4 * rowHeight + 3 * gap
    drawText("⚔", x: centerX + centerWidth / 2, y: centerY + centerHeight / 2 - 32, size: compact ? 48 : 64, fill: color("#a7b9cb"), serif: true, align: .center)
    drawText("Ashenvale", x: centerX + centerWidth / 2, y: centerY + centerHeight / 2 + 12, size: compact ? 15 : 18, fill: color("#f0d381"), bold: true, serif: true, align: .center)
    drawText("Beastlord · Level 100", x: centerX + centerWidth / 2, y: centerY + centerHeight / 2 + 34, size: compact ? 9 : 11, fill: color("#9eacbc"), align: .center)
}

func drawButton(x: CGFloat, y: CGFloat, width: CGFloat, label: String, primary: Bool = false, disabled: Bool = false) {
    drawRect(NSRect(x: x, y: y, width: width, height: 30), fill: color(primary ? "#c49945" : "#172436", alpha: disabled ? 0.48 : 1), stroke: color(primary ? "#e4c16d" : "#7b6841", alpha: disabled ? 0.48 : 1), radius: 3)
    drawText(label, x: x + width / 2, y: y + 8, size: 12, fill: color(primary ? "#1a170f" : "#dfe6ef", alpha: disabled ? 0.48 : 1), bold: true, align: .center)
}

let optionsImage = newImage(width: 1280, height: 800) {
    drawRect(NSRect(x: 0, y: 0, width: 1280, height: 800), fill: color("#080e18"))
    drawRect(NSRect(x: 0, y: 0, width: 1280, height: 82), fill: color("#101d2e"))
    drawIcon(NSRect(x: 44, y: 17, width: 48, height: 48))
    drawText("Loot Captain", x: 104, y: 22, size: 27, fill: color("#f0d381"), bold: true, serif: true)
    drawText("Local character profiles for gear comparison", x: 104, y: 54, size: 13, fill: color("#9eacbc"))
    drawText("CHARACTER SELECT / INVENTORY", x: 64, y: 96, size: 10, fill: color("#8e9daf"))
    drawText("Edit: Ashenvale", x: 64, y: 122, size: 24, fill: color("#e6c26d"), bold: true, serif: true)
    drawButton(x: 1048, y: 119, width: 150, label: "← Back")
    drawRect(NSRect(x: 64, y: 164, width: 1152, height: 100), fill: color("#17263a"), stroke: color("#6e603f"), radius: 5)
    drawText("CHARACTER SHEET", x: 84, y: 178, size: 12, fill: color("#f0d381"), bold: true)
    for (x, label, value, width) in [(84, "Name", "Ashenvale", 330), (448, "Class", "Beastlord", 330), (812, "Level", "100", 330)] {
        drawText(label, x: CGFloat(x), y: 204, size: 11, fill: color("#9eacbc"))
        drawRect(NSRect(x: CGFloat(x), y: 228, width: CGFloat(width), height: 27), fill: color("#07101b"), stroke: color("#4b5b70"), radius: 3)
        drawText(value, x: CGFloat(x + 12), y: 234, size: 12, fill: color("#dfe6ef"))
    }
    drawRect(NSRect(x: 64, y: 284, width: 1152, height: 455), fill: color("#17263a"), stroke: color("#6e603f"), radius: 5)
    drawText("INVENTORY", x: 84, y: 296, size: 16, fill: color("#e1bd69"), bold: true, serif: true)
    drawButton(x: 1100, y: 299, width: 90, label: "+ Add Item", disabled: true)
    drawInventoryPreview(x: 84, y: 332, width: 680, height: 390)
    drawRect(NSRect(x: 786, y: 332, width: 410, height: 390), fill: color("#0b1523"), stroke: color("#52677f"), radius: 5)
    drawText("ITEM DETAILS", x: 806, y: 346, size: 11, fill: color("#d8b767"), bold: true)
    drawButton(x: 1118, y: 342, width: 60, label: "Edit")
    drawIcon(NSRect(x: 806, y: 378, width: 58, height: 58))
    drawText("Embervault Cuirass", x: 878, y: 382, size: 17, fill: color("#f0d381"), bold: true, serif: true)
    drawText("Read-only until Edit", x: 878, y: 408, size: 11, fill: color("#9eacbc"))
    for (yy, label, value) in [(462, "Item Name", "Embervault Cuirass"), (522, "Slot", "Chest")] {
        drawText(label, x: 806, y: CGFloat(yy), size: 10, fill: color("#9eacbc"))
        drawRect(NSRect(x: 806, y: CGFloat(yy + 8), width: 370, height: 27), fill: color("#08111d"), stroke: color("#33475e"), radius: 3)
        drawText(value, x: 818, y: CGFloat(yy + 14), size: 12, fill: color("#8f9dac"))
    }
    drawText("STATS", x: 806, y: 584, size: 10, fill: color("#d6b565"), bold: true)
    for (yy, label, value) in [(610, "AC", "+185"), (646, "HP", "+1,540"), (682, "HDex", "+55")] {
        drawText(label, x: 806, y: CGFloat(yy), size: 12, fill: color("#aab8c8"))
        drawText(value, x: 1130, y: CGFloat(yy), size: 12, fill: color("#8bd0a9"), bold: true, align: .right)
        if yy != 682 { drawLine(NSPoint(x: 806, y: CGFloat(yy + 10)), NSPoint(x: 1176, y: CGFloat(yy + 10)), color: color("#24384f")) }
    }
}

let characterSelectImage = newImage(width: 1280, height: 800) {
    drawRect(NSRect(x: 0, y: 0, width: 1280, height: 800), fill: color("#080e18"))
    drawRect(NSRect(x: 0, y: 0, width: 1280, height: 82), fill: color("#101d2e"))
    drawIcon(NSRect(x: 44, y: 17, width: 48, height: 48))
    drawText("Loot Captain", x: 104, y: 22, size: 27, fill: color("#f0d381"), bold: true, serif: true)
    drawText("Local character profiles for gear comparison", x: 104, y: 54, size: 13, fill: color("#9eacbc"))
    drawText("CHARACTER SELECT / INVENTORY", x: 64, y: 102, size: 10, fill: color("#8e9daf"))
    drawText("Character Select", x: 64, y: 126, size: 24, fill: color("#e6c26d"), bold: true, serif: true)
    drawButton(x: 1018, y: 119, width: 198, label: "+ New Character", primary: true)
    let profiles: [(String, String, String, String)] = [
        ("Ashenvale", "Beastlord · Level 100", "22 items", "Selected"),
        ("Starfall", "Ranger · Level 100", "19 items", "Use Character"),
        ("Lanternroot", "Cleric · Level 95", "17 items", "Use Character")
    ]
    for (index, profile) in profiles.enumerated() {
        let y = 174 + CGFloat(index) * 78
        drawRect(NSRect(x: 64, y: y, width: 1152, height: 64), fill: color("#17263a"), stroke: color(index == 0 ? "#b08b44" : "#6e603f"), radius: 4)
        drawIcon(NSRect(x: 82, y: y + 10, width: 42, height: 42))
        drawText(profile.0, x: 140, y: y + 16, size: 17, fill: color("#f1dfaa"), bold: true, serif: true)
        drawText(profile.1, x: 140, y: y + 39, size: 12, fill: color("#aeb8c5"))
        drawText(profile.2, x: 720, y: y + 27, size: 12, fill: color("#aeb8c5"))
        drawButton(x: 1016, y: y + 17, width: 160, label: profile.3, primary: index == 0)
    }
    drawRect(NSRect(x: 64, y: 426, width: 1152, height: 102), fill: color("#17263a"), stroke: color("#6e603f"), radius: 4)
    drawText("COMPARISON FORMULA", x: 84, y: 442, size: 12, fill: color("#e1bd69"), bold: true)
    drawText("USED ON RAIDLOOT & OPENDKP", x: 1022, y: 442, size: 11, fill: color("#8bd0a9"), bold: true, align: .right)
    drawText("Score formula", x: 84, y: 470, size: 11, fill: color("#aeb8c5"))
    drawRect(NSRect(x: 84, y: 486, width: 420, height: 28), fill: color("#07101b"), stroke: color("#4b5b70"), radius: 3)
    drawText("Weighted upgrade score", x: 98, y: 493, size: 12, fill: color("#dfe6ef"))
    drawText("Controls the base upgrade score shown on supported item pages.", x: 540, y: 492, size: 12, fill: color("#aeb8c5"))
    drawRect(NSRect(x: 64, y: 550, width: 568, height: 176), fill: color("#17263a"), stroke: color("#b08b44"), radius: 4)
    drawText("IMPORT FROM RAIDLOOT", x: 84, y: 568, size: 12, fill: color("#e1bd69"), bold: true)
    drawText("Recommended", x: 512, y: 568, size: 11, fill: color("#8bd0a9"), bold: true, align: .right)
    drawText("Paste a public profile URL or numeric ID to import worn gear and stats.", x: 84, y: 602, size: 12, fill: color("#aeb8c5"))
    drawRect(NSRect(x: 84, y: 634, width: 362, height: 30), fill: color("#07101b"), stroke: color("#4b5b70"), radius: 3)
    drawText("https://www.raidloot.com/profile/...", x: 96, y: 642, size: 11, fill: color("#7d8c9c"))
    drawButton(x: 458, y: 634, width: 142, label: "Import Profile", primary: true)
    drawRect(NSRect(x: 648, y: 550, width: 568, height: 176), fill: color("#17263a"), stroke: color("#6e603f"), radius: 4)
    drawText("IMPORT FROM EVERQUEST", x: 668, y: 568, size: 12, fill: color("#e1bd69"), bold: true)
    drawText("Run /output inventory in game and select the exported file.", x: 668, y: 602, size: 12, fill: color("#aeb8c5"))
    drawButton(x: 668, y: 634, width: 176, label: "Choose Inventory File")
    drawText("Class and level can be entered after import.", x: 668, y: 684, size: 11, fill: color("#7f8d9d"))
}

let raidLootImage = newImage(width: 1280, height: 800) {
    drawSourceImage("raidloot-live-base.jpg", rect: NSRect(x: 0, y: 0, width: 1280, height: 800))
}

let openDkpImage = newImage(width: 1280, height: 800) {
    drawSourceImage("opendkp-item-live.jpg", rect: NSRect(x: 0, y: 0, width: 1280, height: 800))
}

let smallImage = newImage(width: 440, height: 280) {
    drawRect(NSRect(x: 0, y: 0, width: 440, height: 280), fill: color("#101d2e"))
    drawIcon(NSRect(x: 28, y: 56, width: 118, height: 118))
    drawText("Loot", x: 166, y: 72, size: 31, fill: color("#f0d381"), bold: true, serif: true)
    drawText("Captain", x: 166, y: 108, size: 31, fill: color("#f0d381"), bold: true, serif: true)
    drawText("EverQuest gear comparison", x: 168, y: 160, size: 15, fill: color("#c3ceda"))
    drawButton(x: 168, y: 194, width: 180, label: "SLOT-AWARE UPGRADES")
}

let marqueeImage = newImage(width: 1400, height: 560) {
    drawRect(NSRect(x: 0, y: 0, width: 1400, height: 560), fill: color("#101d2e"))
    drawIcon(NSRect(x: 74, y: 118, width: 240, height: 240))
    drawText("Loot Captain", x: 368, y: 122, size: 56, fill: color("#f0d381"), bold: true, serif: true)
    drawText("Manage your character. Compare every slot.", x: 372, y: 202, size: 25, fill: color("#dfe6ef"))
    drawText("Local profiles · EQ inventory layout · RaidLoot + OpenDKP", x: 372, y: 252, size: 18, fill: color("#9fb0c3"))
    drawButton(x: 372, y: 318, width: 210, label: "UPGRADE  +1,240")
    drawText("No account. No tracking. Your profiles stay local.", x: 372, y: 438, size: 15, fill: color("#8fa0b4"))
    drawInventoryPreview(x: 842, y: 64, width: 486, height: 430, compact: true)
}

try? FileManager.default.createDirectory(at: storeAssets, withIntermediateDirectories: true)
try? FileManager.default.createDirectory(at: docsAssets, withIntermediateDirectories: true)
try? FileManager.default.createDirectory(at: iconDirectory, withIntermediateDirectories: true)
save(optionsImage, as: "screenshot-options-1280x800.png", alsoCopyTo: docsAssets.appendingPathComponent("screenshot-options-1280x800.png"))
save(characterSelectImage, as: "screenshot-character-select-1280x800.png", alsoCopyTo: docsAssets.appendingPathComponent("screenshot-character-select-1280x800.png"))
save(raidLootImage, as: "screenshot-comparison-1280x800.png", alsoCopyTo: docsAssets.appendingPathComponent("screenshot-comparison-1280x800.png"))
save(openDkpImage, as: "screenshot-opendkp-1280x800.png", alsoCopyTo: docsAssets.appendingPathComponent("screenshot-opendkp-1280x800.png"))
save(smallImage, as: "promo-small-440x280.png")
save(marqueeImage, as: "promo-marquee-1400x560.png")
save(newImage(width: 128, height: 128) { drawLootCaptainMark(NSRect(x: 0, y: 0, width: 128, height: 128)) }, as: "icon128.png", directory: iconDirectory)
save(newImage(width: 48, height: 48) { drawLootCaptainMark(NSRect(x: 0, y: 0, width: 48, height: 48)) }, as: "icon48.png", directory: iconDirectory)
save(newImage(width: 16, height: 16) { drawLootCaptainMark(NSRect(x: 0, y: 0, width: 16, height: 16)) }, as: "icon16.png", directory: iconDirectory)
