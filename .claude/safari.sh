#!/bin/bash
# Safari interaction helper for Claude Code
# Usage: safari.sh <command> [args...]

CMD="${1:-help}"
shift

case "$CMD" in
  # Inject console log capture - run this first on any page
  inject)
    osascript -e 'tell application "Safari" to do JavaScript "
      if (!window.__consoleLogs) {
        window.__consoleLogs = [];
        const orig = {
          log: console.log, warn: console.warn, error: console.error,
          info: console.info, debug: console.debug
        };
        [\"log\",\"warn\",\"error\",\"info\",\"debug\"].forEach(function(m) {
          console[m] = function() {
            var args = Array.from(arguments).map(function(a) {
              try { return typeof a === \"object\" ? JSON.stringify(a) : String(a); }
              catch(e) { return String(a); }
            });
            window.__consoleLogs.push({type: m, msg: args.join(\" \"), ts: Date.now()});
            if (window.__consoleLogs.length > 500) window.__consoleLogs.shift();
            orig[m].apply(console, arguments);
          };
        });
        window.addEventListener(\"error\", function(e) {
          window.__consoleLogs.push({type:\"error\", msg: e.message + \" at \" + e.filename + \":\" + e.lineno, ts: Date.now()});
        });
        window.addEventListener(\"unhandledrejection\", function(e) {
          window.__consoleLogs.push({type:\"error\", msg: \"Unhandled rejection: \" + e.reason, ts: Date.now()});
        });
        \"Console capture injected\"
      } else {
        \"Console capture already active\"
      }
    " in current tab of front window'
    ;;

  # Read captured console logs
  logs)
    FILTER="${1:-all}"
    osascript -e "tell application \"Safari\" to do JavaScript \"
      (function() {
        var logs = window.__consoleLogs || [];
        var filter = '$FILTER';
        if (filter !== 'all') logs = logs.filter(function(l) { return l.type === filter; });
        return logs.map(function(l) {
          return '[' + l.type.toUpperCase() + '] ' + l.msg;
        }).join('\\n') || 'No logs captured';
      })()
    \" in current tab of front window"
    ;;

  # Clear captured logs
  clear)
    osascript -e 'tell application "Safari" to do JavaScript "window.__consoleLogs = []; \"Logs cleared\"" in current tab of front window'
    ;;

  # Execute arbitrary JavaScript
  js)
    JS_CODE="$*"
    osascript -e "tell application \"Safari\" to do JavaScript \"$JS_CODE\" in current tab of front window"
    ;;

  # Get current page URL
  url)
    osascript -e 'tell application "Safari" to get URL of current tab of front window'
    ;;

  # Get current page title
  title)
    osascript -e 'tell application "Safari" to get name of front window'
    ;;

  # Navigate to a URL
  goto)
    URL="$1"
    osascript -e "tell application \"Safari\" to set URL of current tab of front window to \"$URL\""
    ;;

  # Get page HTML (trimmed)
  html)
    osascript -e 'tell application "Safari" to do JavaScript "document.documentElement.outerHTML" in current tab of front window'
    ;;

  # Get visible text content
  text)
    osascript -e 'tell application "Safari" to do JavaScript "document.body.innerText" in current tab of front window'
    ;;

  # Screenshot
  screenshot)
    FILE="${1:-/tmp/safari_screenshot.png}"
    screencapture -l $(osascript -e 'tell application "Safari" to get id of front window') "$FILE" 2>/dev/null || screencapture -w "$FILE"
    echo "Screenshot saved to $FILE"
    ;;

  # Click an element by CSS selector
  click)
    SEL="$1"
    osascript -e "tell application \"Safari\" to do JavaScript \"var el = document.querySelector('$SEL'); if(el){el.click();'clicked'}else{'element not found'}\" in current tab of front window"
    ;;

  # Type into an input by CSS selector
  type)
    SEL="$1"
    VAL="$2"
    osascript -e "tell application \"Safari\" to do JavaScript \"var el = document.querySelector('$SEL'); if(el){el.value='$VAL';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));'typed'}else{'element not found'}\" in current tab of front window"
    ;;

  # List all network errors from performance API
  network)
    osascript -e 'tell application "Safari" to do JavaScript "
      var entries = performance.getEntriesByType(\"resource\");
      var failed = entries.filter(function(e) { return e.transferSize === 0 && e.decodedBodySize === 0; });
      failed.map(function(e) { return e.name; }).join(\"\n\") || \"No failed network requests\"
    " in current tab of front window'
    ;;

  help)
    echo "Safari interaction commands:"
    echo "  inject          - Start capturing console logs (run first!)"
    echo "  logs [type]     - Read logs (all|log|warn|error|info|debug)"
    echo "  clear           - Clear captured logs"
    echo "  js <code>       - Execute JavaScript"
    echo "  url             - Get current page URL"
    echo "  title           - Get current page title"
    echo "  goto <url>      - Navigate to URL"
    echo "  html            - Get page HTML"
    echo "  text            - Get visible text"
    echo "  screenshot [f]  - Take screenshot"
    echo "  click <sel>     - Click element by CSS selector"
    echo "  type <sel> <v>  - Type into input"
    echo "  network         - Show failed network requests"
    ;;
esac
