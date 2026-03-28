#!/usr/bin/env python3
"""
Playwright test for the Policy Argument Engine UI.
Verifies the dropdown, generate button, and output rendering.
"""

import time
from playwright.sync_api import sync_playwright

ESTIMATE_URL = "http://localhost:4200/#/app/estimating/8ebda6ee-f6f6-4df5-9e8d-575b729a3315"
LOGIN_URL = "http://localhost:4200/#/login"
EMAIL = "navisingh@live.in"
PASSWORD = "aD19Ke^5"
SCREENSHOT_DIR = "/Users/peterguzzi/Desktop/UPA_PORTAL_FULL_FRONTEND_BACKEND/screenshots"


def main():
    import os
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=300)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})

        # Login
        print("[1/4] Logging in...")
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
        time.sleep(5)
        print("  Logged in.")

        # Navigate to estimate
        print("[2/4] Navigating to estimate...")
        page.goto(ESTIMATE_URL)
        page.wait_for_load_state("networkidle")
        time.sleep(4)

        # Scroll right panel to find Policy Argument Engine
        print("[3/4] Finding Policy Argument Engine...")
        # Scroll the right panel
        page.evaluate("""() => {
            const panels = document.querySelectorAll('.right-section, .policy-intel-card, [class*="scroll"]');
            panels.forEach(p => p.scrollTop = p.scrollHeight);
        }""")
        time.sleep(1)

        # Check for the argument section
        arg_section = page.locator(".policy-argument-section")
        if arg_section.first.is_visible(timeout=5000):
            print("  Policy Argument Engine section found!")
            arg_section.first.screenshot(
                path=f"{SCREENSHOT_DIR}/arg_01_section.png"
            )

            # Check for the dropdown and button
            dropdown = page.locator(".argument-type-field")
            generate_btn = page.locator("text=Generate Policy Argument")

            if dropdown.first.is_visible(timeout=2000):
                print("  Argument type dropdown visible.")
            if generate_btn.first.is_visible(timeout=2000):
                print("  Generate Argument button visible.")

                # Click generate
                print("[4/4] Generating argument (this takes ~10s)...")
                generate_btn.first.click()
                time.sleep(2)

                # Wait for the argument to appear (watch for spinner to disappear)
                for i in range(30):
                    try:
                        textarea = page.locator(".argument-textarea, textarea")
                        if textarea.first.is_visible(timeout=1000):
                            text = textarea.first.input_value() or textarea.first.text_content() or ""
                            if len(text) > 50:
                                print(f"  Argument generated! ({len(text)} chars)")
                                print(f"  First 200 chars: {text[:200]}")
                                break
                    except Exception:
                        pass
                    time.sleep(1)

                # Screenshot the result
                time.sleep(1)
                page.evaluate("""() => {
                    const panels = document.querySelectorAll('.right-section, .policy-intel-card');
                    panels.forEach(p => p.scrollTop = p.scrollHeight);
                }""")
                time.sleep(0.5)

                arg_section.first.screenshot(
                    path=f"{SCREENSHOT_DIR}/arg_02_generated.png"
                )

                # Check for action buttons (Copy, Insert)
                copy_btn = page.locator("text=Copy")
                insert_btn = page.locator("text=Insert into Report")
                if copy_btn.first.is_visible(timeout=2000):
                    print("  Copy button visible.")
                if insert_btn.first.is_visible(timeout=2000):
                    print("  Insert into Report button visible.")
            else:
                print("  Generate Argument button NOT visible.")
        else:
            print("  Policy Argument Engine section NOT found!")
            # Debug - check DOM
            result = page.evaluate("""() => {
                const els = document.querySelectorAll('[class*="argument"]');
                return Array.from(els).map(e => ({
                    tag: e.tagName, cls: e.className,
                    visible: e.offsetHeight > 0,
                    text: e.textContent?.substring(0, 80)
                }));
            }""")
            for el in result[:5]:
                print(f"  {el}")

        # Final screenshot
        page.screenshot(path=f"{SCREENSHOT_DIR}/arg_03_final.png", full_page=True)

        print("\n=== POLICY ARGUMENT ENGINE TEST COMPLETE ===")
        print(f"Screenshots: {SCREENSHOT_DIR}/arg_*.png")

        time.sleep(3)
        browser.close()


if __name__ == "__main__":
    main()
