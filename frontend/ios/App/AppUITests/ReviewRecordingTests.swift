import XCTest

/// App Review walkthrough for Calorize, recorded by Xcode's automatic screen recording (see ReviewRecording.xctestplan).
/// Flow: home screen → launch → register (4-step wizard) → dashboard → log out → demo login → dashboard → scan a photo
///       from the library → analyze → save → reports → feed → open post → author profile → Block → log out
///       → log into the new account → Delete Account → login screen.
/// (The app has no "Report post" feature yet, so that step is not shown.)
/// Credentials and names come from the environment (xcodebuild passes TEST_RUNNER_* variables through).
final class ReviewRecordingTests: XCTestCase {
    let env = ProcessInfo.processInfo.environment
    lazy var bundleId = env["APP_BUNDLE_ID"] ?? "app.probooking.calorize"
    lazy var appName = env["APP_NAME"] ?? "Calorize"
    lazy var app = XCUIApplication(bundleIdentifier: bundleId)
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")

    override func setUpWithError() throws {
        continueAfterFailure = true // a missed tap should not stop the recording
    }

    // MARK: - helpers
    func pause(_ s: Double = 1.0) { RunLoop.current.run(until: Date().addingTimeInterval(s)) }
    /// Waits until any of the elements exists; returns its index, or nil on timeout.
    @discardableResult func waitAny(_ elements: [XCUIElement], _ timeout: Double = 10) -> Int? {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if let i = elements.firstIndex(where: { $0.exists }) { return i }
            pause(0.3)
        } while Date() < deadline
        return nil
    }
    @discardableResult func tapIfExists(_ e: XCUIElement, _ timeout: Double = 3) -> Bool {
        guard e.waitForExistence(timeout: timeout) else { return false }
        e.tap(); pause(); return true
    }
    /// Screenshot + accessibility tree in the result bundle, so a failed run shows where the flow diverged.
    func checkpoint(_ name: String, tree: Bool = false) {
        XCTContext.runActivity(named: "checkpoint: \(name)") { activity in
            let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            shot.name = name; shot.lifetime = .keepAlways; activity.add(shot)
            if tree {
                let dump = XCTAttachment(string: app.debugDescription)
                dump.name = "\(name).tree.txt"; dump.lifetime = .keepAlways; activity.add(dump)
            }
        }
    }
    /// Fails the test (but keeps recording) and attaches the screen + tree when an expected screen does not appear.
    @discardableResult func expect(_ e: XCUIElement, _ what: String, _ timeout: Double = 10) -> Bool {
        if e.waitForExistence(timeout: timeout) { return true }
        checkpoint("missing \(what)", tree: true)
        XCTFail("expected \(what)")
        return false
    }
    /// Button or link (web content exposes <button> and <a>) whose label equals `label` (case-insensitive) —
    /// or, with `prefix`, starts with it.
    func button(_ label: String, prefix: Bool = false, contains: Bool = false) -> XCUIElement {
        let op = contains ? "CONTAINS[c]" : prefix ? "BEGINSWITH[c]" : "==[c]"
        let p = NSPredicate(format: "(elementType == %d OR elementType == %d) AND label \(op) %@",
                            XCUIElement.ElementType.button.rawValue, XCUIElement.ElementType.link.rawValue, label)
        return app.descendants(matching: .any).matching(p).firstMatch
    }
    var loginScreen: XCUIElement { app.webViews.secureTextFields.firstMatch }
    var tabBarStats: XCUIElement { button("Stats") }

    func type(_ field: XCUIElement, _ value: String) {
        guard field.waitForExistence(timeout: 5) else {
            XCTContext.runActivity(named: "no field for \(value.contains("@") ? "email" : "input")") { _ in }
            return
        }
        // WKWebView inputs: tap by coordinate, then type at the first responder once the software keyboard is up.
        func focus() { field.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap(); pause(0.7) }
        focus()
        // iOS offers a strong password / password saving on secure fields; decline and refocus
        if field.elementType == .secureTextField {
            let prompt = app.buttons.matching(NSPredicate(format: "label IN %@",
                ["Choose My Own Password", "Not Now", "Use My Own Password"])).firstMatch
            if prompt.waitForExistence(timeout: 1) { prompt.tap(); pause(0.5); focus() }
        }
        var tries = 0
        while app.keyboards.count == 0 && tries < 3 { focus(); tries += 1 }
        guard app.keyboards.count > 0 else {
            XCTContext.runActivity(named: "no keyboard for \(field.label) — is 'Connect Hardware Keyboard' off in the Simulator?") { _ in }
            return
        }
        app.typeText(value); pause(0.5)
        // React controlled inputs sometimes drop characters when typed quickly: verify, and retype slowly if needed
        func landed() -> Bool {
            let v = (field.value as? String) ?? ""
            if field.elementType == .secureTextField { return v.count == value.count }
            return v == value
        }
        if !landed() {
            field.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).press(forDuration: 1.0); pause(0.5)
            if app.menuItems["Select All"].exists { app.menuItems["Select All"].tap(); pause(0.3) }
            app.typeText(XCUIKeyboardKey.delete.rawValue); pause(0.3)
            for ch in value { app.typeText(String(ch)); pause(0.08) }
            pause(0.5)
            XCTContext.runActivity(named: "retyped \(field.label) slowly — ok: \(landed())") { _ in }
        }
    }
    func dismissKeyboard() {
        let done = app.toolbars.buttons["Done"].firstMatch
        if done.exists { done.tap() } else if app.keyboards.count > 0 { app.swipeDown() }
        pause(0.5)
    }
    /// window.confirm() and iOS permission prompts are native alerts; take the affirmative option.
    @discardableResult func acceptAlert(_ timeout: Double = 5) -> Bool {
        for alert in [app.alerts.firstMatch, springboard.alerts.firstMatch] where alert.waitForExistence(timeout: timeout) {
            pause(0.8) // let the viewer read it
            for name in ["OK", "Allow", "Allow While Using App", "Continue", "Delete", "Block", "Yes"] where alert.buttons[name].exists {
                alert.buttons[name].tap(); pause(); return true
            }
            alert.buttons.element(boundBy: alert.buttons.count - 1).tap(); pause(); return true
        }
        return false
    }
    func openTab(_ name: String) { tapIfExists(button(name), 5); pause() }
    /// Logged out, the app shows the public Discover page; its "Log In" button leads to the login form.
    func showLoginForm() {
        if waitAny([loginScreen, button("Log In")]) == 1 { button("Log In").tap(); pause() }
    }
    func login(_ email: String, _ pass: String) {
        showLoginForm()
        expect(loginScreen, "login screen")
        type(app.webViews.textFields.firstMatch, email)
        type(app.webViews.secureTextFields.firstMatch, pass)
        dismissKeyboard()
        tapIfExists(button("Sign In"), 5)
        expect(tabBarStats, "tab bar after login", 20); pause(2)
    }
    /// Public profiles (/u/…) are outside the tabbed layout: scroll up and take "← Back to app".
    func backToTabs() {
        if button("Home").exists { return }
        app.swipeDown(); pause(0.5); app.swipeDown(); pause(0.5); app.swipeDown(); pause()
        tapIfExists(button("Back to app", contains: true), 5); pause()
    }
    /// Logout lives on the settings page: Home → top-bar profile icon → scroll → Logout.
    func openSettings() {
        backToTabs()
        openTab("Home")
        app.swipeDown(); pause(0.5); app.swipeDown(); pause()   // the top bar scrolls away with the feed
        tapIfExists(button("Profile"), 5); pause(2)
        app.swipeUp(); pause(); app.swipeUp(); pause()
    }
    /// The Profile page is long (reminders, sign-in methods): keep scrolling until `e` is on screen.
    @discardableResult func scrollTo(_ e: XCUIElement, maxSwipes: Int = 8) -> XCUIElement {
        var n = 0
        while e.exists && !e.isHittable && n < maxSwipes { app.swipeUp(); pause(0.5); n += 1 }
        return e
    }
    func logout() {
        openSettings()
        tapIfExists(scrollTo(button("Logout")), 5)
        expect(button("Log In"), "public Discover page after logout"); pause(2)
    }

    // MARK: - the walkthrough
    func testReviewWalkthrough() throws {
        let demoUser = env["DEMO_USER"] ?? "", demoPass = env["DEMO_PASS"] ?? ""
        XCTAssertFalse(demoUser.isEmpty, "DEMO_USER / DEMO_PASS not passed (TEST_RUNNER_DEMO_USER)")
        let stamp = Int(Date().timeIntervalSince1970) % 1_000_000
        let newEmail = "review+\(stamp)@calorize-review.sample", newPass = "Review-\(stamp)-Pass!"

        // 0. Begin on the home screen and launch from the icon, as App Review asked.
        app.terminate()
        XCUIDevice.shared.press(.home); pause(1)
        // tell record-review-video.sh where the video should start (Simulator: the test runs on the Mac, same disk)
        if let dir = env["MARKER_DIR"] {
            try? "\(Date().timeIntervalSince1970)".write(toFile: dir + "/home", atomically: true, encoding: .utf8)
        }
        pause(1.5)
        let icon = springboard.icons[appName]
        if icon.waitForExistence(timeout: 3) && !icon.isHittable { springboard.swipeLeft(); pause(1.5) }  // icon on page 2
        if icon.exists && icon.isHittable { icon.tap() } else { app.launch() }
        _ = app.wait(for: .runningForeground, timeout: 15); pause(3)
        // a previous run may have left a session behind — the walkthrough starts logged out
        if waitAny([loginScreen, button("Log In"), tabBarStats], 15) == 2 { logout() }
        showLoginForm()
        checkpoint("launched")

        // 1. Registration (4-step wizard).
        tapIfExists(button("Sign up"), 5); pause()
        if expect(app.webViews.secureTextFields.firstMatch, "registration step 1") {
            let f = app.webViews.textFields
            type(f.element(boundBy: 0), "Review Tester")
            type(f.element(boundBy: 1), newEmail)
            type(app.webViews.secureTextFields.firstMatch, newPass)
            dismissKeyboard()
            checkpoint("register step 1")
            tapIfExists(button("Next"))                 // → age / gender / height / weight
            if expect(f.element(boundBy: 2), "registration step 2 fields") {
                type(f.element(boundBy: 0), "32")
                type(f.element(boundBy: 1), "178")
                type(f.element(boundBy: 2), "82")
                dismissKeyboard()
            }
            checkpoint("register step 2")
            tapIfExists(button("Next"))                 // → goal (Lose weight) + target weight + activity
            if expect(f.firstMatch, "registration step 3 target weight") { type(f.firstMatch, "76"); dismissKeyboard() }
            checkpoint("register step 3")
            tapIfExists(button("Next"))                 // → summary
            checkpoint("register step 4")
            // Terms / Privacy agreement checkbox (required since 2026-10-10; Start Tracking is disabled until ticked)
            let agree = app.webViews.switches.firstMatch
            if agree.waitForExistence(timeout: 3) { agree.tap() }
            else { tapIfExists(app.webViews.staticTexts.containing(NSPredicate(format: "label BEGINSWITH 'I agree'")).firstMatch) }
            pause()
            tapIfExists(button("Start Tracking"), 5)
        }

        // 2. First look at the new account: feed, then the Stats dashboard; log out.
        expect(tabBarStats, "app tabs after registration", 20); pause(2)
        // First-run "Welcome to Calorize" screens (new accounts only, since 2026-10-10) cover the tab bar
        if tapIfExists(button("Skip"), 5) { pause(1.5) }
        openTab("Stats"); pause(2)
        checkpoint("new account dashboard")
        app.swipeUp(); pause(); app.swipeDown(); pause()
        logout()

        // 3. Log in with the demo account (has history, so every screen has data).
        login(demoUser, demoPass)
        checkpoint("demo logged in")

        // 4. Dashboard → Scan → photo library → analyze → save.
        openTab("Stats"); pause(2); app.swipeUp(); pause(); app.swipeDown(); pause()
        openTab("Scan"); pause(2)
        expect(button("Choose Photo"), "scan page")
        tapIfExists(button("Choose Photo"), 5)
        if tapIfExists(app.buttons["Photo Library"], 5) {
            acceptAlert(2)
            // the newest photo is the sample meal the script added (`simctl addmedia`); the picker lists newest first
            let photos = app.images.matching(NSPredicate(format: "label BEGINSWITH[c] 'Photo,'"))
            if expect(photos.firstMatch, "photo picker", 10) {
                pause(1.5)
                // the picker runs out of process: its cells report "not hittable", so tap by coordinate
                photos.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap(); pause(2)
                for name in ["Choose", "Add", "Done"] where app.buttons[name].exists { app.buttons[name].tap(); pause(); break }
            }
        }
        checkpoint("photo chosen")
        // the Stats page has an "AI Nutrition Analysis" button too — only analyze once the scan shows the preview
        if expect(app.webViews.images["Food preview"], "photo preview on the scan page") {
            tapIfExists(button("AI Nutrition Analysis", contains: true), 8)   // "✨ AI Nutrition Analysis"
        }
        if app.webViews.staticTexts["Update Your Weight"].waitForExistence(timeout: 4) {   // asked when the weight is stale
            type(app.webViews.textFields.firstMatch, "78"); dismissKeyboard()
            tapIfExists(button("Submit"), 3)
        }
        // AI result: the meal is created with the scan; "Done ✓" confirms it (or "Save Changes" on low confidence)
        let done = button("Done", prefix: true), saveChanges = button("Save Changes"), applyFilter = button("Apply Filter")
        var deadline = Date().addingTimeInterval(90)
        while Date() < deadline && !done.exists && !saveChanges.exists && !applyFilter.exists { pause(1) }
        if applyFilter.exists {                                    // photo filter step comes first
            pause(1.5); checkpoint("photo filter"); applyFilter.tap(); pause(2)
            deadline = Date().addingTimeInterval(60)
            while Date() < deadline && !done.exists && !saveChanges.exists { pause(1) }
        }
        pause(3)
        checkpoint("analysis result")
        if saveChanges.exists { saveChanges.tap(); pause(2) }
        if !tapIfExists(done, 3) && !saveChanges.exists { XCTFail("no analysis result"); checkpoint("no analysis result", tree: true) }
        pause(3)
        checkpoint("meal saved")

        // 5. Reports / stats.
        openTab("Stats"); pause(2); app.swipeUp(); pause(1.5)
        tapIfExists(button("Reports"), 3); pause(3)                 // weekly charts
        app.swipeUp(); pause(2); app.swipeUp(); pause(2); app.swipeDown(); pause()
        checkpoint("reports")

        // 6. Feed, then Discover → open a post. (No "Report" in the app yet — skipped.)
        openTab("Home"); pause(3); app.swipeUp(); pause(); app.swipeDown(); pause()
        openTab("Discover"); pause(4)
        checkpoint("discover")
        let tile = app.webViews.images.allElementsBoundByIndex.first { $0.frame.width > 100 && $0.isHittable && !$0.label.isEmpty }
        if let tile = tile { tile.tap(); pause(4) } else { XCTFail("no post on Discover"); checkpoint("no post", tree: true) }
        checkpoint("post opened")

        // 7. Author's profile (the link under the post photo) → Block.
        let modalPhoto = app.webViews.images.allElementsBoundByIndex
            .filter { $0.isHittable && $0.frame.width > 280 }.min { $0.frame.minY < $1.frame.minY }
        let authorLink = modalPhoto.flatMap { photo in
            app.webViews.links.allElementsBoundByIndex
                .filter { $0.isHittable && $0.frame.minY >= photo.frame.maxY - 2 }
                .min { $0.frame.minY < $1.frame.minY }
        }
        if let link = authorLink { link.tap() } else { XCTFail("no author link in the post"); checkpoint("no author link", tree: true) }
        pause(4)
        if expect(button("Block"), "Block button on the author's profile") {
            checkpoint("author profile")
            button("Block").tap()
            if !acceptAlert() { XCTFail("no block confirmation") }
            pause(2)
            checkpoint("blocked")
        }

        // 8. Switch to the account created in step 1 and delete it.
        logout()
        login(newEmail, newPass)
        openSettings()
        if tapIfExists(scrollTo(button("Delete Account")), 5) {
            if !acceptAlert() { XCTFail("no first delete confirmation") }   // two confirmations
            if !acceptAlert() { XCTFail("no second delete confirmation") }
        } else { XCTFail("no Delete Account button"); checkpoint("no delete", tree: true) }
        pause(2)
        showLoginForm()
        XCTAssertTrue(loginScreen.waitForExistence(timeout: 15), "expected the login screen after the account was deleted")
        pause(3)
        checkpoint("account deleted")
    }
}
