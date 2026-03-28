#!/usr/bin/env python3
"""
End-to-end Playwright test for Policy Intelligence analysis.
Focused on verifying data values in Coverage Snapshot, Key Provisions, and Policy Notes.
"""

import time
from playwright.sync_api import sync_playwright


ESTIMATE_PROJECT_ID = "8ebda6ee-f6f6-4df5-9e8d-575b729a3315"
LOGIN_URL = "http://localhost:4200/#/login"
ESTIMATE_URL = f"http://localhost:4200/#/app/estimating/{ESTIMATE_PROJECT_ID}"

EMAIL = "navisingh@live.in"
PASSWORD = "aD19Ke^5"

SCREENSHOT_DIR = "/Users/peterguzzi/Desktop/UPA_PORTAL_FULL_FRONTEND_BACKEND/screenshots"


def main():
    import os
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=300)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})

        # Step 1: Login
        print("[1/5] Logging in...")
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

        # Step 2: Navigate to estimate detail
        print("[2/5] Navigating to estimate...")
        page.goto(ESTIMATE_URL)
        page.wait_for_load_state("networkidle")
        time.sleep(4)

        # Step 3: Verify Coverage Snapshot data
        print("[3/5] Verifying Coverage Snapshot...")
        snapshot = page.locator(".policy-coverage-snapshot")
        if snapshot.first.is_visible(timeout=5000):
            # Extract all snapshot card values
            cards = page.evaluate("""() => {
                const cards = document.querySelectorAll('.policy-snapshot-card');
                return Array.from(cards).map(c => {
                    const label = c.querySelector('.ps-label')?.textContent?.trim() || '';
                    const value = c.querySelector('.ps-value')?.textContent?.trim() || '';
                    return { label, value };
                });
            }""")
            print("  Coverage Snapshot data:")
            for card in cards:
                print(f"    {card['label']}: {card['value']}")

            # Screenshot the snapshot section
            snapshot.first.screenshot(path=f"{SCREENSHOT_DIR}/03_coverage_snapshot_focused.png")
            print("  Screenshot saved.")
        else:
            print("  Coverage Snapshot NOT visible!")

        # Step 4: Verify Key Provisions
        print("[4/5] Checking Key Provisions...")
        # Scroll the right panel to find provisions
        right_panel = page.locator(".policy-intel-card, .right-section")
        if right_panel.first.is_visible(timeout=2000):
            # Scroll within the right panel
            right_panel.first.evaluate("el => el.scrollTop = el.scrollHeight")
            time.sleep(1)

        provisions_section = page.locator(".policy-provisions")
        if provisions_section.first.is_visible(timeout=3000):
            # Extract provision titles
            provision_titles = page.evaluate("""() => {
                const cards = document.querySelectorAll('.provision-expand-card, .provision-expand-header');
                return Array.from(cards).map(c => c.querySelector('.pp-title')?.textContent?.trim() || c.textContent?.trim().substring(0, 50));
            }""")
            print("  Key Provisions:")
            for title in provision_titles:
                print(f"    - {title}")

            # Click each provision to expand and capture data
            provision_cards = page.locator(".provision-expand-card")
            count = provision_cards.count()
            for i in range(min(count, 3)):
                try:
                    provision_cards.nth(i).click()
                    time.sleep(0.3)
                except Exception:
                    pass

            provisions_section.first.screenshot(
                path=f"{SCREENSHOT_DIR}/04_key_provisions_focused.png"
            )
            print(f"  Found {count} provision cards.")
        else:
            print("  Key Provisions section not visible (may need scrolling)")
            # Try scrolling more aggressively
            page.evaluate("""() => {
                const panels = document.querySelectorAll('.policy-intel-card, .right-section, [class*="scroll"]');
                panels.forEach(p => p.scrollTop = p.scrollHeight);
            }""")
            time.sleep(1)
            provisions_section2 = page.locator(".policy-provisions")
            if provisions_section2.first.is_visible(timeout=2000):
                print("  Key Provisions found after scroll!")
                provisions_section2.first.screenshot(
                    path=f"{SCREENSHOT_DIR}/04_key_provisions_focused.png"
                )

        # Step 5: Verify Policy Notes
        print("[5/5] Checking Policy Notes...")
        notes_btn = page.locator("text=Extracted Policy Notes")
        if notes_btn.first.is_visible(timeout=3000):
            notes_btn.first.click()
            time.sleep(1)

            # Extract the notes content
            notes_data = page.evaluate("""() => {
                const blocks = document.querySelectorAll('.policy-note-block');
                return Array.from(blocks).map(b => {
                    const title = b.querySelector('.pn-title')?.textContent?.trim() || '';
                    const text = b.querySelector('.pn-text')?.textContent?.trim()?.substring(0, 200) || '';
                    return { title, text };
                });
            }""")
            print("  Policy Notes:")
            for note in notes_data:
                print(f"    [{note['title']}]: {note['text'][:150]}...")

            notes_section = page.locator(".policy-notes-body")
            if notes_section.first.is_visible(timeout=2000):
                notes_section.first.screenshot(
                    path=f"{SCREENSHOT_DIR}/05_policy_notes_focused.png"
                )
        else:
            print("  Policy Notes toggle not found.")

        # Full-page screenshot
        page.screenshot(path=f"{SCREENSHOT_DIR}/06_final_full.png", full_page=True)

        # Summary
        print("\n" + "=" * 60)
        print("POLICY INTELLIGENCE E2E TEST RESULTS")
        print("=" * 60)

        time.sleep(3)
        browser.close()


if __name__ == "__main__":
    main()
