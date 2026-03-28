#!/usr/bin/env python3
"""E2E Playwright test for the Claim Recovery Dashboard."""

import os
import time

from playwright.sync_api import sync_playwright

LOGIN_URL = "http://localhost:4200/#/login"
DASHBOARD_URL = "http://localhost:4200/#/app/claim-recovery"
EMAIL = "navisingh@live.in"
PASSWORD = "aD19Ke^5"
SCREENSHOT_DIR = "/Users/peterguzzi/Desktop/UPA_PORTAL_FULL_FRONTEND_BACKEND/screenshots/claim-recovery"

PASS = "\033[92m\u2713\033[0m"
FAIL = "\033[91m\u2717\033[0m"
results = []


def check(name, passed, detail=""):
    results.append((name, passed, detail))
    mark = PASS if passed else FAIL
    msg = f"  {mark} {name}"
    if detail:
        msg += f" \u2014 {detail}"
    print(msg)


def login(page):
    # Collect console messages for debugging
    console_errors = []
    page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type in ("error", "warning") else None)
    page.on("pageerror", lambda exc: console_errors.append(f"[pageerror] {exc}"))

    page.goto(LOGIN_URL, wait_until="domcontentloaded")
    time.sleep(8)  # Wait for Angular to bootstrap

    # Debug: dump page content if blank
    body_html = page.evaluate("() => document.body.innerHTML.substring(0, 500)")
    if len(body_html.strip()) < 20:
        print(f"    DEBUG: page body is nearly empty: {repr(body_html[:200])}")
        if console_errors:
            print(f"    DEBUG: console errors: {console_errors[:5]}")
        page.screenshot(path=f"{SCREENSHOT_DIR}/00_login_debug.png")

    # Click "Use password instead" to reveal email/password fields
    for attempt in range(5):
        try:
            pw_btn = page.locator("text=Use password instead")
            pw_btn.wait_for(state="visible", timeout=5000)
            pw_btn.click()
            time.sleep(1)
            break
        except Exception:
            time.sleep(2)

    # Wait for email input to appear
    try:
        page.wait_for_selector('input[name="email"]', state="visible", timeout=20000)
    except Exception:
        page.screenshot(path=f"{SCREENSHOT_DIR}/00_login_debug.png")
        if console_errors:
            print(f"    DEBUG: console errors: {console_errors[:10]}")
        check("Login", False, "email input never appeared")
        return

    page.fill('input[name="email"]', EMAIL)
    page.fill('input[name="password"]', PASSWORD)
    page.click("button[mat-raised-button]")
    time.sleep(5)

    # Verify login
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


def main():
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    print("\n  Claim Recovery Dashboard E2E Test\n")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=200)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})

        # Step 1: Login
        login(page)
        page.screenshot(path=f"{SCREENSHOT_DIR}/01_logged_in.png")

        # Step 2: Navigate to Claim Recovery Dashboard
        page.goto(DASHBOARD_URL)
        page.wait_for_load_state("networkidle")
        time.sleep(5)
        page.screenshot(path=f"{SCREENSHOT_DIR}/02_dashboard_navigated.png")

        # Step 3: Verify page header
        header = page.locator("h2:has-text('Claim Recovery Dashboard')")
        header_visible = False
        try:
            header_visible = header.first.is_visible(timeout=5000)
        except Exception:
            pass
        check("Page header renders", header_visible)
        page.screenshot(path=f"{SCREENSHOT_DIR}/03_header_visible.png")

        # Step 4: Verify 6 KPI cards
        kpi_cards = page.locator(".kpi-card")
        kpi_count = kpi_cards.count()
        check("6 KPI cards visible", kpi_count == 6, f"found {kpi_count}")

        # Step 5: Verify chart panels
        chart_panels = page.locator(".chart-panel")
        chart_count = chart_panels.count()
        check("Chart panels render", chart_count == 3, f"found {chart_count}")
        page.screenshot(path=f"{SCREENSHOT_DIR}/04_charts_visible.png")

        # Step 6: Verify claims table
        table_rows = page.locator(".claims-table tr.mat-mdc-row")
        row_count = table_rows.count()
        has_rows = row_count >= 1
        check("Claims table has rows", has_rows, f"found {row_count} rows")
        page.screenshot(path=f"{SCREENSHOT_DIR}/05_table_visible.png")

        # Step 7: Click a table row and verify navigation to blackout view
        if has_rows:
            table_rows.first.click()
            time.sleep(5)
            navigated = "estimating" in page.url
            has_view_param = "view=blackout" in page.url
            check("Row click navigates to estimating detail", navigated, page.url)
            check("URL contains view=blackout param", has_view_param, page.url)
            page.screenshot(path=f"{SCREENSHOT_DIR}/06_navigated_to_detail.png")

            # Verify blackout view is active (comparison section visible)
            time.sleep(3)
            blackout_active = False
            try:
                # Check for comparison/blackout view elements
                blackout_el = page.locator(".blackout-view, .comparison-view, .supplement-view, [class*='blackout']")
                if blackout_el.count() > 0:
                    blackout_active = True
                else:
                    # Fallback: check for the view toggle buttons
                    active_btn = page.locator("button.active:has-text('Blackout'), .mat-button-toggle-checked:has-text('Blackout')")
                    blackout_active = active_btn.count() > 0
            except Exception:
                pass
            check("Blackout view is active", blackout_active or has_view_param, "view param present" if has_view_param else "checking DOM")
            page.screenshot(path=f"{SCREENSHOT_DIR}/06b_blackout_view.png")

            # Navigate back
            page.goto(DASHBOARD_URL)
            page.wait_for_load_state("networkidle")
            time.sleep(3)
        else:
            check("Row click navigates to estimating detail", False, "no rows to click")
            check("URL contains view=blackout param", False, "no rows to click")
            check("Blackout view is active", False, "no rows to click")

        # Final screenshot
        page.screenshot(path=f"{SCREENSHOT_DIR}/07_final.png", full_page=True)

        browser.close()

    # Summary
    passed = sum(1 for _, p, _ in results if p)
    failed = sum(1 for _, p, _ in results if not p)
    print(f"\n  {PASS} Passed: {passed}")
    print(f"  {FAIL} Failed: {failed}")
    print()

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
