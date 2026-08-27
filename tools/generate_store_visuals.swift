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

func drawTabs(x: CGFloat, y: CGFloat, width: CGFloat, labels: [String], active: Int, height: CGFloat = 34) {
    guard !labels.isEmpty else { return }
    drawRect(NSRect(x: x, y: y, width: width, height: height), fill: color("#0e1827"), stroke: color("#8e713d"), radius: 2)
    let gap: CGFloat = 3
    let tabWidth = (width - gap * CGFloat(labels.count + 1)) / CGFloat(labels.count)
    for (index, label) in labels.enumerated() {
        let tx = x + gap + CGFloat(index) * (tabWidth + gap)
        drawRect(NSRect(x: tx, y: y + 4, width: tabWidth, height: height - 4), fill: color(index == active ? "#17263a" : "#0e1827"), stroke: color(index == active ? "#8e713d" : "#31455e"), radius: 2)
        drawText(label.uppercased(), x: tx + tabWidth / 2, y: y + 14, size: width < 520 ? 9 : 10, fill: color(index == active ? "#f3d277" : "#a7b2c0"), bold: true, align: .center)
    }
}

func drawBadge(x: CGFloat, y: CGFloat, width: CGFloat, label: String, state: String = "upgrade") {
    let fill: String
    let stroke: String
    let text: String
    switch state {
    case "downgrade":
        fill = "#673c36"; stroke = "#b78162"; text = "#ffe3d0"
    case "sidegrade":
        fill = "#655735"; stroke = "#d0aa5b"; text = "#fff1c8"
    case "focus":
        fill = "#315c4a"; stroke = "#76c9bd"; text = "#d9f4d6"
    default:
        fill = "#315c4a"; stroke = "#c8a85a"; text = "#d9f4d6"
    }
    drawRect(NSRect(x: x, y: y, width: width, height: 25), fill: color(fill), stroke: color(stroke), radius: 3)
    drawText(label, x: x + width / 2, y: y + 6, size: 10, fill: color(text), bold: true, align: .center)
}

func drawStar(x: CGFloat, y: CGFloat, filled: Bool = true, size: CGFloat = 20) {
    drawText(filled ? "★" : "☆", x: x, y: y, size: size, fill: color(filled ? "#e0b95f" : "#b7974f"), bold: true, align: .center)
}

func drawCompareTable(x: CGFloat, y: CGFloat, width: CGFloat, rows: [(String, String, String, String)], baseline: String = "wishlist") {
    let rowHeight: CGFloat = 25
    drawText("stat", x: x, y: y, size: 10, fill: color("#e6c26d"), bold: true)
    drawText(baseline, x: x + width * 0.43, y: y, size: 10, fill: color("#e6c26d"), bold: true, align: .right)
    drawText("candidate", x: x + width * 0.68, y: y, size: 10, fill: color("#e6c26d"), bold: true, align: .right)
    drawText("delta", x: x + width, y: y, size: 10, fill: color("#e6c26d"), bold: true, align: .right)
    drawLine(NSPoint(x: x, y: y + 18), NSPoint(x: x + width, y: y + 18), color: color("#465d78"))
    for (index, row) in rows.enumerated() {
        let ry = y + 23 + CGFloat(index) * rowHeight
        if index % 2 == 0 { drawRect(NSRect(x: x - 4, y: ry - 4, width: width + 8, height: rowHeight), fill: color("#14243a")) }
        drawText(row.0, x: x, y: ry, size: 10, fill: color("#c3ceda"), bold: true)
        drawText(row.1, x: x + width * 0.43, y: ry, size: 10, fill: color("#dbe3dc"), align: .right)
        drawText(row.2, x: x + width * 0.68, y: ry, size: 10, fill: color("#dbe3dc"), align: .right)
        drawText(row.3, x: x + width, y: ry, size: 10, fill: color("#84d7a2"), bold: true, align: .right)
    }
}

func drawFocusList(x: CGFloat, y: CGFloat, width: CGFloat) {
    let entries: [(String, String, String, Bool)] = [
        ("FOCUS", "Improved Damage V", "Phantasmal Luclinite Idol", false),
        ("FOCUS", "Mana Preservation IV", "Embervault Cuirass", false),
        ("PROC", "Strike of Ice", "Frostbound Claw", true),
        ("PROC", "Flame of the Ancients", "Stormedge Blade", true),
    ]
    for (index, entry) in entries.enumerated() {
        let rowY = y + CGFloat(index) * 39
        drawRect(NSRect(x: x, y: rowY, width: width, height: 32), fill: color(entry.3 ? "#102631" : "#0c1727"), stroke: color(entry.3 ? "#3f7f7a" : (index == 0 ? "#e1bf6c" : "#52657d")), radius: 3)
        drawText(entry.0, x: x + 12, y: rowY + 10, size: 9, fill: color(entry.3 ? "#9ee0d6" : "#d8b767"), bold: true)
        drawText(entry.1, x: x + 67, y: rowY + 9, size: 11, fill: color(entry.3 ? "#9ee0d6" : "#f0dfad"), bold: true)
        drawText(entry.2, x: x + width - 12, y: rowY + 10, size: 10, fill: color("#aab8c8"), align: .right)
    }
}

func drawEffectDetails(x: CGFloat, y: CGFloat, width: CGFloat) {
    drawText("SPELL FOCUS DETAILS", x: x, y: y, size: 11, fill: color("#d8b767"), bold: true)
    drawLine(NSPoint(x: x, y: y + 20), NSPoint(x: x + width, y: y + 20), color: color("#4a5b70"))
    drawText("Improved Damage V", x: x, y: y + 33, size: 15, fill: color("#f0d381"), bold: true, serif: true)
    drawText("DETAILS", x: x, y: y + 62, size: 9, fill: color("#d8b767"), bold: true)
    drawText("Increase Spell Damage by 105% to 120%", x: x, y: y + 78, size: 11, fill: color("#dbe3dc"))
    drawText("(v124, Before DoT Crit, After DD Crit)", x: x, y: y + 96, size: 10, fill: color("#aab8c8"))
    drawText("ON ITEM", x: x, y: y + 125, size: 9, fill: color("#d8b767"), bold: true)
    drawText("Phantasmal Luclinite Idol", x: x, y: y + 141, size: 11, fill: color("#dbe3dc"))
    drawText("PROC  ·  Strike of Ice  ·  1,200 dmg", x: x, y: y + 169, size: 10, fill: color("#9ee0d6"), bold: true)
    drawText("Frostbound Claw  ·  Primary", x: x, y: y + 186, size: 10, fill: color("#aab8c8"))
}

let optionsImage = newImage(width: 1280, height: 800) {
    drawRect(NSRect(x: 0, y: 0, width: 1280, height: 800), fill: color("#080e18"))
    drawRect(NSRect(x: 0, y: 0, width: 1280, height: 82), fill: color("#101d2e"))
    drawIcon(NSRect(x: 44, y: 17, width: 48, height: 48))
    drawText("Loot Captain", x: 104, y: 22, size: 27, fill: color("#f0d381"), bold: true, serif: true)
    drawText("Local character profiles for gear comparison", x: 104, y: 54, size: 13, fill: color("#9eacbc"))
    drawText("CHARACTER SELECT / INVENTORY", x: 64, y: 96, size: 10, fill: color("#8e9daf"))
    drawText("Edit: Ashenvale", x: 64, y: 122, size: 24, fill: color("#e6c26d"), bold: true, serif: true)
    drawText("Character", x: 592, y: 129, size: 10, fill: color("#aeb8c5"))
    drawRect(NSRect(x: 652, y: 119, width: 170, height: 28), fill: color("#09121f"), stroke: color("#4b5b70"), radius: 2)
    drawText("Ashenvale  ▾", x: 664, y: 126, size: 11, fill: color("#f0eee5"))
    drawButton(x: 830, y: 119, width: 76, label: "+ New")
    drawButton(x: 914, y: 119, width: 78, label: "Delete")
    drawButton(x: 1000, y: 119, width: 78, label: "Save", primary: true)
    drawButton(x: 1086, y: 119, width: 130, label: "← Back")
    drawRect(NSRect(x: 64, y: 164, width: 1152, height: 170), fill: color("#17263a"), stroke: color("#6e603f"), radius: 5)
    drawText("CHARACTER SHEET", x: 84, y: 178, size: 12, fill: color("#f0d381"), bold: true)
    for (x, label, value, width) in [(84, "Name", "Ashenvale", 330), (448, "Class", "Beastlord", 330), (812, "Level", "100", 330)] {
        drawText(label, x: CGFloat(x), y: 204, size: 11, fill: color("#9eacbc"))
        drawRect(NSRect(x: CGFloat(x), y: 228, width: CGFloat(width), height: 27), fill: color("#07101b"), stroke: color("#4b5b70"), radius: 3)
        drawText(value, x: CGFloat(x + 12), y: 234, size: 12, fill: color("#dfe6ef"))
    }
    drawLine(NSPoint(x: 84, y: 274), NSPoint(x: 1196, y: 274), color: color("#3a4a61"))
    drawText("WISHLIST", x: 84, y: 286, size: 11, fill: color("#e1bd69"), bold: true)
    drawText("3 items", x: 1196, y: 286, size: 10, fill: color("#8bd0a9"), align: .right)
    for (x, name, slot) in [(84, "Nebulous Assault's Cloak", "Back"), (420, "Dreadstone Band", "Finger"), (760, "Gleaming Augment", "Augment")] {
        drawStar(x: CGFloat(x), y: 304, filled: true, size: 17)
        drawText(name, x: CGFloat(x + 16), y: 307, size: 10, fill: color("#dfe6ef"), bold: true)
        drawText(slot, x: CGFloat(x + 16), y: 322, size: 9, fill: color("#8e9daf"))
    }
    drawRect(NSRect(x: 64, y: 350, width: 1152, height: 400), fill: color("#17263a"), stroke: color("#6e603f"), radius: 5)
    drawText("INVENTORY", x: 84, y: 362, size: 16, fill: color("#e1bd69"), bold: true, serif: true)
    drawText("18 worn items  ·  4 augments  ·  4 gear effects", x: 280, y: 366, size: 10, fill: color("#8bd0a9"))
    drawButton(x: 1100, y: 359, width: 90, label: "+ Add Item", disabled: true)
    drawRect(NSRect(x: 84, y: 392, width: 700, height: 340), fill: color("#090e17"), stroke: color("#826738"), radius: 5, lineWidth: 2)
    drawTabs(x: 96, y: 402, width: 676, labels: ["Equipment", "Augments", "Spell Focus"], active: 2)
    drawText("SPELL FOCUS & PROCS", x: 108, y: 449, size: 10, fill: color("#9faec1"), bold: true)
    drawFocusList(x: 108, y: 467, width: 652)
    drawRect(NSRect(x: 108, y: 644, width: 652, height: 31), fill: color("#191a24"), stroke: color("#a27c40"), radius: 4)
    drawText("Auto-Inventory", x: 120, y: 654, size: 10, fill: color("#efd080"), bold: true)
    drawText("4 gear effects", x: 748, y: 654, size: 10, fill: color("#efd080"), bold: true, align: .right)
    drawRect(NSRect(x: 802, y: 392, width: 394, height: 340), fill: color("#0b1523"), stroke: color("#52677f"), radius: 5)
    drawButton(x: 1118, y: 402, width: 60, label: "Edit")
    drawEffectDetails(x: 822, y: 410, width: 354)
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
    drawText("1AC = 10HP", x: 98, y: 493, size: 12, fill: color("#dfe6ef"))
    drawText("Controls the base upgrade score. Weapons also show Damage/Delay ratio when available.", x: 540, y: 492, size: 12, fill: color("#aeb8c5"))
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
    // The live page leaves a wide margin beside the item detail; use it for
    // the extension's intentionally compact, click-through comparison panel.
    drawStar(x: 620, y: 77, filled: true, size: 22)
    drawBadge(x: 646, y: 76, width: 110, label: "vs wishlist ↑")
    drawRect(NSRect(x: 674, y: 68, width: 540, height: 700), fill: color("#0b1523", alpha: 0.97), stroke: color("#a38348"), radius: 4, lineWidth: 2)
    drawText("LOOT CAPTAIN", x: 698, y: 88, size: 12, fill: color("#d8b767"), bold: true)
    drawText("Ashenvale  ·  Beastlord  ·  Level 100", x: 698, y: 111, size: 12, fill: color("#b7c4d2"))
    drawStar(x: 700, y: 137, filled: true, size: 22)
    drawText("Nebulous Assault's Cloak", x: 716, y: 141, size: 15, fill: color("#f0d381"), bold: true, serif: true)
    drawText("Local wishlist baseline", x: 716, y: 163, size: 10, fill: color("#8bd0a9"))
    drawBadge(x: 698, y: 184, width: 108, label: "up +1,240")
    drawBadge(x: 816, y: 184, width: 86, label: "focus up", state: "focus")
    drawBadge(x: 912, y: 184, width: 92, label: "R proc up", state: "focus")
    drawText("COMPARE VS WISHLIST", x: 698, y: 231, size: 11, fill: color("#e6c26d"), bold: true)
    drawCompareTable(x: 698, y: 250, width: 482, rows: [
        ("HP", "6,120", "11,008", "+4,888"),
        ("AC", "325", "409", "+84"),
        ("Spell Dmg", "23", "90", "+67"),
    ])
    drawText("SPELL FOCUS (1 change)", x: 698, y: 363, size: 10, fill: color("#d8b767"), bold: true)
    drawText("Improved Damage V  →  Improved Damage VI", x: 698, y: 382, size: 11, fill: color("#dbe3dc"))
    drawText("105–120% effective @ L125", x: 698, y: 400, size: 10, fill: color("#8bd0a9"))
    drawText("PROC (1 change)", x: 698, y: 432, size: 10, fill: color("#d8b767"), bold: true)
    drawText("Strike of Ice  ·  900 dmg  →  1,200 dmg", x: 698, y: 451, size: 11, fill: color("#9ee0d6"))
    drawLine(NSPoint(x: 698, y: 481), NSPoint(x: 1180, y: 481), color: color("#465d78"))
    drawText("Click any badge for the full stat/effect diff.", x: 698, y: 502, size: 11, fill: color("#c3ceda"))
    drawText("Profiles and wishlist data stay in this browser.", x: 698, y: 523, size: 10, fill: color("#8e9daf"))
}

let openDkpImage = newImage(width: 1280, height: 800) {
    drawSourceImage("opendkp-item-live.jpg", rect: NSRect(x: 0, y: 0, width: 1280, height: 800))
    // Live auction rows are highlighted only when a local wishlist matches.
    drawRect(NSRect(x: 386, y: 291, width: 837, height: 50), fill: color("#8c6e29", alpha: 0.16), stroke: color("#d3ae5a", alpha: 0.82), radius: 2, lineWidth: 2)
    drawStar(x: 810, y: 302, filled: true, size: 20)
    drawBadge(x: 836, y: 297, width: 108, label: "vs wishlist ↑")
    drawBadge(x: 950, y: 297, width: 77, label: "P up")
    drawBadge(x: 1033, y: 297, width: 86, label: "focus up", state: "focus")
    drawRect(NSRect(x: 356, y: 474, width: 897, height: 169), fill: color("#111c2b", alpha: 0.98), stroke: color("#a38348"), radius: 4, lineWidth: 2)
    drawText("LOOT CAPTAIN  ·  ASHENVALE", x: 382, y: 492, size: 12, fill: color("#f0d381"), bold: true)
    drawBadge(x: 1038, y: 484, width: 128, label: "LIVE AUCTION", state: "focus")
    drawText("★  Wishlist match highlighted", x: 382, y: 520, size: 11, fill: color("#e0b95f"), bold: true)
    drawText("Phantasmal Luclinite Idol  ·  Range", x: 382, y: 541, size: 11, fill: color("#c3ceda"))
    drawCompareTable(x: 382, y: 560, width: 842, rows: [
        ("HP", "6,120", "11,008", "+4,888"),
        ("AC", "325", "409", "+84"),
        ("Spell Dmg", "23", "90", "+67"),
    ])
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
// Chrome's store icon should breathe: keep roughly 16 px transparent padding
// around the 96 px artwork. Toolbar icons intentionally remain full-size.
save(newImage(width: 128, height: 128) { drawLootCaptainMark(NSRect(x: 18, y: 18, width: 92, height: 92)) }, as: "icon128.png", directory: iconDirectory)
save(newImage(width: 48, height: 48) { drawLootCaptainMark(NSRect(x: 0, y: 0, width: 48, height: 48)) }, as: "icon48.png", directory: iconDirectory)
save(newImage(width: 16, height: 16) { drawLootCaptainMark(NSRect(x: 0, y: 0, width: 16, height: 16)) }, as: "icon16.png", directory: iconDirectory)
