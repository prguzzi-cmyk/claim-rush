#!/usr/bin/env python3
"""
Full E2E Playwright test for Policy Intelligence UI pipeline.

Tests:
1. Navigate to estimate with no policy linked
2. Upload or import a policy PDF via the frontend
3. Click "Analyze Policy" and wait for pipeline to complete
4. Verify Coverage Snapshot, Key Provisions, Policy Notes render
5. Generate a policy argument
6. Test "Into Email" button
7. Test "Into Report" button
"""

import time
from playwright.sync_api import sync_playwright

ESTIMATE_URL = "http://localhost:4200/#/app/estimating/8ebda6ee-f6f6-4df5-9e8d-575b729a3315"
LOGIN_URL = "http://localhost:4200/#/login"
EMAIL = "navisingh@live.in"
PASSWORD = "aD19Ke^5"
PDF_PATH = "/tmp/test_homesite_policy.pdf"
SCREENSHOT_DIR = "/Users/peterguzzi/Desktop/UPA_PORTAL_FULL_FRONTEND_BACKEND/screenshots/full_pipeline"

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
results = []


def check(name, passed, detail=""):
    results.append((name, passed, detail))
    mark = PASS if passed else FAIL
    msg = f"  {mark} {name}"
    if detail:
        msg += f" — {detail}"
    print(msg)


def scroll_to_policy_intel(page):
    """Scroll right panel to the policy intel card."""
    page.evaluate("""() => {
        const card = document.querySelector('.policy-intel-card');
        if (card) card.scrollIntoView({ behavior: 'instant', block: 'start' });
    }""")
    time.sleep(0.5)


def scroll_to_bottom(page):
    """Scroll right panel to the bottom."""
    page.evaluate("""() => {
        const panels = document.querySelectorAll('.right-section, .policy-intel-card');
        panels.forEach(p => p.scrollTop = p.scrollHeight);
    }""")
    time.sleep(0.5)


def main():
    import os
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=200)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})

        # ═══════════════════════════════════════════════════════════
        # STEP 1: LOGIN
        # ═══════════════════════════════════════════════════════════
        print("\n[STEP 1] Login")
        page.goto(LOGIN_URL)
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        try:
            pw_btn = page.locator("text=Use password instead")
            if pw_btn.is_visible(timeout=3000):
                pw_btn.click()
                time.sleep(0.5)
        except Exception:
            pass
        page.fill('input[name="email"]', EMAIL)
        page.fill('input[name="password"]', PASSWORD)
        page.click('button[mat-raised-button]')
        # Wait for login form to disappear (auth redirect)
        login_form_gone = False
        for _ in range(10):
            time.sleep(1)
            try:
                email_input = page.locator('input[name="email"]')
                if not email_input.is_visible(timeout=500):
                    login_form_gone = True
                    break
            except Exception:
                login_form_gone = True
                break
        check("Login", login_form_gone)

        # ═══════════════════════════════════════════════════════════
        # STEP 2: NAVIGATE TO ESTIMATE
        # ═══════════════════════════════════════════════════════════
        print("\n[STEP 2] Navigate to estimate")
        page.goto(ESTIMATE_URL)
        page.wait_for_load_state("networkidle")
        time.sleep(5)
        check("Estimate page loaded", "estimating" in page.url)
        page.screenshot(path=f"{SCREENSHOT_DIR}/01_estimate_loaded.png")

        # ═══════════════════════════════════════════════════════════
        # STEP 3: FIND POLICY INTEL CARD & GET POLICY LOADED
        # ═══════════════════════════════════════════════════════════
        print("\n[STEP 3] Find Policy Intelligence card")

        scroll_to_policy_intel(page)
        time.sleep(1)

        # Check if policy is already loaded (from a previous run)
        policy_already_loaded = False
        try:
            status_pill = page.locator(".policy-status-pill")
            if status_pill.first.is_visible(timeout=2000):
                status_text = status_pill.first.text_content().strip()
                policy_already_loaded = status_text in ["Complete", "Analyzed", "Not Analyzed"]
                if policy_already_loaded:
                    print(f"  Policy already loaded (status: {status_text})")
        except Exception:
            pass

        if not policy_already_loaded:
            # Look for "Import as Policy" buttons (claim file PDFs available)
            import_btn = page.locator("text=Import as Policy")
            import_visible = False
            try:
                import_visible = import_btn.first.is_visible(timeout=3000)
            except Exception:
                pass

            if import_visible:
                print("  Claim file PDFs found — using Import as Policy")
                import_btn.first.click()
                check("Import as Policy clicked", True)

                # Wait for import to complete
                import_done = False
                for i in range(30):
                    try:
                        snack = page.locator("text=Policy imported")
                        if snack.first.is_visible(timeout=1000):
                            import_done = True
                            break
                        # Also check if policyDoc appeared (status pill)
                        pill = page.locator(".policy-status-pill")
                        if pill.first.is_visible(timeout=500):
                            import_done = True
                            break
                    except Exception:
                        pass
                    time.sleep(1)
                check("Policy imported from claim file", import_done)
            else:
                # Look for "Upload Policy" button
                upload_btn = page.locator("text=Upload Policy")
                upload_visible = False
                try:
                    upload_visible = upload_btn.first.is_visible(timeout=3000)
                except Exception:
                    pass

                if upload_visible:
                    print("  Using Upload Policy button")
                    # Use filechooser event to handle hidden file input
                    with page.expect_file_chooser() as fc_info:
                        upload_btn.first.click()
                    file_chooser = fc_info.value
                    file_chooser.set_files(PDF_PATH)
                    check("Upload Policy file selected", True)

                    # Wait for upload to complete
                    upload_done = False
                    for i in range(20):
                        try:
                            snack = page.locator("text=Policy uploaded")
                            if snack.first.is_visible(timeout=1000):
                                upload_done = True
                                break
                            pill = page.locator(".policy-status-pill")
                            if pill.first.is_visible(timeout=500):
                                upload_done = True
                                break
                        except Exception:
                            pass
                        time.sleep(1)
                    check("Policy PDF uploaded", upload_done)
                else:
                    # Debug: check what the policy intel card shows
                    print("  Neither Import nor Upload visible — debugging...")
                    debug_info = page.evaluate("""() => {
                        const card = document.querySelector('.policy-intel-card');
                        if (!card) return 'No .policy-intel-card found';
                        return card.innerHTML.substring(0, 500);
                    }""")
                    print(f"  Card HTML: {debug_info[:200]}")
                    check("Policy onboarding visible", False, "Neither import nor upload found")

        page.screenshot(path=f"{SCREENSHOT_DIR}/02_policy_onboarded.png")
        time.sleep(1)

        # ═══════════════════════════════════════════════════════════
        # STEP 4: CLICK ANALYZE POLICY
        # ═══════════════════════════════════════════════════════════
        print("\n[STEP 4] Click Analyze Policy")

        scroll_to_policy_intel(page)
        time.sleep(1)

        analyze_btn = page.locator("text=Analyze Policy")
        analyze_visible = False
        try:
            analyze_visible = analyze_btn.first.is_visible(timeout=5000)
        except Exception:
            pass

        if analyze_visible:
            check("Analyze Policy button visible", True)
            analyze_btn.first.click()
            time.sleep(1)

            # Check for analyzing state
            analyzing_text = page.locator("text=Analyzing")
            is_analyzing = False
            try:
                is_analyzing = analyzing_text.first.is_visible(timeout=3000)
            except Exception:
                pass
            check("Analyzing state shown", is_analyzing)
            page.screenshot(path=f"{SCREENSHOT_DIR}/03_analyzing.png")

            # Wait for analysis to complete (3 API calls, ~30-90 seconds)
            print("  Waiting for analysis to complete (up to 180s)...")
            analysis_done = False
            for i in range(90):
                try:
                    # Check if the Coverage Snapshot appeared
                    snapshot = page.locator(".policy-coverage-snapshot")
                    if snapshot.first.is_visible(timeout=1000):
                        analysis_done = True
                        break
                    # Or check for status pill showing Complete
                    pill = page.locator(".policy-status-pill")
                    if pill.first.is_visible(timeout=500):
                        pill_text = pill.first.text_content().strip()
                        if pill_text == "Complete":
                            analysis_done = True
                            break
                except Exception:
                    pass
                time.sleep(2)

            check("Analysis completed", analysis_done)
            page.screenshot(path=f"{SCREENSHOT_DIR}/04_analysis_complete.png")
        else:
            # Maybe already analyzed?
            try:
                snapshot = page.locator(".policy-coverage-snapshot")
                if snapshot.first.is_visible(timeout=3000):
                    print("  Policy already analyzed — Coverage Snapshot visible")
                    check("Analyze Policy (already done)", True, "Coverage Snapshot already visible")
                else:
                    check("Analyze Policy button visible", False, "button not found, snapshot not visible")
            except Exception:
                check("Analyze Policy button visible", False, "button not found")

        # ═══════════════════════════════════════════════════════════
        # STEP 5: VERIFY COVERAGE SNAPSHOT
        # ═══════════════════════════════════════════════════════════
        print("\n[STEP 5] Verify Coverage Snapshot")

        scroll_to_policy_intel(page)
        time.sleep(1)

        snapshot_data = page.evaluate("""() => {
            const cards = document.querySelectorAll('.policy-snapshot-card');
            return Array.from(cards).map(c => {
                const label = c.querySelector('.ps-label')?.textContent?.trim() || '';
                const value = c.querySelector('.ps-value')?.textContent?.trim() || '';
                return { label, value };
            });
        }""")

        if snapshot_data:
            has_carrier = any(d["label"] == "Carrier Name" and d["value"] != "Not detected" for d in snapshot_data)
            has_dwelling = any(d["label"] == "Dwelling Limit" and "$" in d["value"] for d in snapshot_data)
            has_address = any(d["label"] == "Property Address" and d["value"] != "Not detected" for d in snapshot_data)

            check("Carrier populated", has_carrier,
                  next((d["value"] for d in snapshot_data if d["label"] == "Carrier Name"), ""))
            check("Dwelling Limit populated", has_dwelling,
                  next((d["value"] for d in snapshot_data if d["label"] == "Dwelling Limit"), ""))
            check("Property Address populated", has_address,
                  next((d["value"] for d in snapshot_data if d["label"] == "Property Address"), ""))

            snapshot_el = page.locator(".policy-coverage-snapshot")
            try:
                if snapshot_el.first.is_visible(timeout=2000):
                    snapshot_el.first.screenshot(path=f"{SCREENSHOT_DIR}/05_coverage_snapshot.png")
            except Exception:
                pass
        else:
            check("Coverage Snapshot cards", False, "no .policy-snapshot-card elements found")

        # ═══════════════════════════════════════════════════════════
        # STEP 6: VERIFY KEY PROVISIONS
        # ═══════════════════════════════════════════════════════════
        print("\n[STEP 6] Verify Key Provisions")

        scroll_to_bottom(page)
        time.sleep(1)

        provisions = page.locator(".policy-provisions")
        provisions_visible = False
        try:
            provisions_visible = provisions.first.is_visible(timeout=3000)
        except Exception:
            pass
        check("Key Provisions section visible", provisions_visible)

        if provisions_visible:
            # Try to expand a provision that has content
            # Check multiple provision types since AI classification may vary
            provision_found = False
            for prov_name in ["Loss Settlement", "Duties After Loss", "Appraisal", "Ordinance or Law"]:
                try:
                    prov_btn = page.locator(f"text={prov_name}")
                    if prov_btn.first.is_visible(timeout=1000):
                        prov_btn.first.click()
                        time.sleep(0.5)

                        provision_body = page.evaluate("""() => {
                            const bodies = document.querySelectorAll('.provision-expand-body');
                            return Array.from(bodies).filter(b => b.offsetHeight > 0)
                                .map(b => b.textContent?.trim().substring(0, 100));
                        }""")
                        has_content = len(provision_body) > 0 and any(
                            t and t != "Not detected" for t in provision_body
                        )
                        if has_content:
                            # Show the first non-"Not detected" body
                            content_text = next(
                                (t for t in provision_body if t and t != "Not detected"),
                                provision_body[0] if provision_body else ""
                            )
                            check(f"{prov_name} has content", True,
                                  content_text[:80])
                            provision_found = True
                            break
                except Exception:
                    pass

            if not provision_found:
                check("Key Provision content found", False, "none of the provisions had content")

            try:
                provisions.first.screenshot(path=f"{SCREENSHOT_DIR}/06_key_provisions.png")
            except Exception:
                pass

        # ═══════════════════════════════════════════════════════════
        # STEP 7: VERIFY POLICY NOTES
        # ═══════════════════════════════════════════════════════════
        print("\n[STEP 7] Verify Policy Notes")

        scroll_to_bottom(page)
        time.sleep(0.5)

        notes_btn = page.locator("text=Extracted Policy Notes")
        notes_visible = False
        try:
            notes_visible = notes_btn.first.is_visible(timeout=3000)
        except Exception:
            pass
        check("Policy Notes toggle visible", notes_visible)

        if notes_visible:
            notes_btn.first.click()
            time.sleep(1)
            notes_data = page.evaluate("""() => {
                const blocks = document.querySelectorAll('.policy-note-block');
                return Array.from(blocks).map(b => ({
                    title: b.querySelector('.pn-title')?.textContent?.trim() || '',
                    text: b.querySelector('.pn-text')?.textContent?.trim()?.substring(0, 150) || ''
                }));
            }""")
            has_summary = any(d["title"] == "AI Summary" and len(d["text"]) > 50 for d in notes_data)
            has_guidance = any(d["title"] == "Claim Guidance Notes" and len(d["text"]) > 50 for d in notes_data)
            check("AI Summary populated", has_summary)
            check("Claim Guidance Notes populated", has_guidance)

        # ═══════════════════════════════════════════════════════════
        # STEP 8: GENERATE POLICY ARGUMENT
        # ═══════════════════════════════════════════════════════════
        print("\n[STEP 8] Generate policy argument")

        scroll_to_bottom(page)
        time.sleep(1)

        gen_btn = page.locator("text=Generate Policy Argument")
        gen_visible = False
        try:
            gen_visible = gen_btn.first.is_visible(timeout=3000)
        except Exception:
            pass
        check("Generate Argument button visible", gen_visible)

        if gen_visible:
            gen_btn.first.click()
            print("  Waiting for argument generation (~15s)...")

            # Wait for argument textarea to appear
            arg_generated = False
            for i in range(30):
                try:
                    textarea = page.locator(".argument-textarea")
                    if textarea.first.is_visible(timeout=1000):
                        val = textarea.first.input_value()
                        if val and len(val) > 50:
                            arg_generated = True
                            check("Argument generated", True, f"{len(val)} chars")
                            break
                except Exception:
                    pass
                time.sleep(1)

            if not arg_generated:
                # Try getting text content instead
                try:
                    textarea = page.locator(".argument-textarea")
                    if textarea.first.is_visible(timeout=1000):
                        val = textarea.first.evaluate("el => el.value || el.textContent")
                        if val and len(val) > 50:
                            arg_generated = True
                            check("Argument generated", True, f"{len(val)} chars")
                except Exception:
                    pass

            if not arg_generated:
                check("Argument generated", False, "timeout")

            scroll_to_bottom(page)
            time.sleep(0.5)
            page.screenshot(path=f"{SCREENSHOT_DIR}/07_argument_generated.png")

        # ═══════════════════════════════════════════════════════════
        # STEP 9: TEST "INTO EMAIL" BUTTON
        # ═══════════════════════════════════════════════════════════
        print("\n[STEP 9] Test 'Into Email' button")

        email_btn = page.locator("text=Into Email")
        email_visible = False
        try:
            email_visible = email_btn.first.is_visible(timeout=3000)
        except Exception:
            pass
        check("Into Email button visible", email_visible)

        if email_visible:
            # Grant clipboard permission
            page.context.grant_permissions(["clipboard-read", "clipboard-write"])

            email_btn.first.click()
            time.sleep(1)

            # Check for snackbar confirmation
            snack = page.locator("text=copied")
            snack_visible = False
            try:
                snack_visible = snack.first.is_visible(timeout=3000)
            except Exception:
                pass
            check("Into Email copied to clipboard", snack_visible)

            # Try reading clipboard content
            try:
                clipboard = page.evaluate("() => navigator.clipboard.readText()")
                has_argument = clipboard and len(clipboard) > 100
                check("Clipboard contains argument text", has_argument,
                      f"{len(clipboard)} chars" if clipboard else "empty")
            except Exception as e:
                check("Clipboard read", False, str(e)[:80])

            page.screenshot(path=f"{SCREENSHOT_DIR}/08_into_email.png")

        # ═══════════════════════════════════════════════════════════
        # STEP 10: TEST "INTO REPORT" BUTTON
        # ═══════════════════════════════════════════════════════════
        print("\n[STEP 10] Test 'Into Report' button")

        report_btn = page.locator("text=Into Report")
        report_visible = False
        report_disabled = True
        try:
            report_visible = report_btn.first.is_visible(timeout=3000)
            if report_visible:
                report_disabled = report_btn.first.is_disabled()
        except Exception:
            pass

        check("Into Report button visible", report_visible)
        if report_visible and report_disabled:
            check("Into Report disabled (no comparison)", True,
                  "Expected — requires carrier estimate comparison first")
        elif report_visible and not report_disabled:
            report_btn.first.click()
            time.sleep(3)
            check("Into Report clicked", True)
            page.screenshot(path=f"{SCREENSHOT_DIR}/09_into_report.png")

        # ═══════════════════════════════════════════════════════════
        # FINAL SCREENSHOT
        # ═══════════════════════════════════════════════════════════
        page.screenshot(path=f"{SCREENSHOT_DIR}/10_final.png", full_page=True)

        # ═══════════════════════════════════════════════════════════
        # RESULTS SUMMARY
        # ═══════════════════════════════════════════════════════════
        print("\n" + "=" * 60)
        print("FULL UI PIPELINE TEST RESULTS")
        print("=" * 60)
        passed = sum(1 for _, p, _ in results if p)
        failed = sum(1 for _, p, _ in results if not p)
        print(f"\n  {PASS} Passed: {passed}")
        print(f"  {FAIL} Failed: {failed}")
        print(f"  Total:  {len(results)}")
        if failed:
            print("\n  Failed checks:")
            for name, p, detail in results:
                if not p:
                    print(f"    {FAIL} {name}: {detail}")
        print(f"\n  Screenshots: {SCREENSHOT_DIR}/")

        time.sleep(3)
        browser.close()


if __name__ == "__main__":
    main()
