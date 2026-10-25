# Interview log connection

The deployed owner-run Apps Script verifies each Firebase ID token through Identity Toolkit, reads its existing authSessions mapping, and permits the active admin account only. It is restricted to the existing interview workbook. The web-app URL is stored in the user's private recruiting settings. No password, refresh token, service-account key, or candidate dataset is checked into this repository.

The page checks every 20 seconds while visible and no edit dialog is open. Reopening the page catches up. Cloud saves schedule another check. The bridge matches phone, name, interview date and time before adopting an existing row; mappings allow subsequent same-month schedule changes without appending duplicates. External O changes win over an old page value and are attributed to the interview date. An idempotent sheet event avoids double counting. When a sheet-origin O is removed, its event is removed. Unchanged candidate details do not overwrite manual sheet notes. Existing data validation and formatting are preserved.

Bookings without a known call date remain uncounted until the date is supplied. The interview page includes selection, a bulk actual-booking-date action, and header-free TSV rows in the workbook's 14-column order. Channels are selected explicitly; Albamon imports identify their source. A sheet channel can populate a legacy candidate that has no channel.

Limitations: a missing future month tab reports a sync error; it is not silently created. Moving an existing interview across month tabs requires checking the old month's row. A page must be open for sheet changes to be mirrored into the private recruiting record; the sheet itself remains available when the PC is off. Current connection is for the owner's admin account, not every Hub member.

Validation: model, bulk import, authenticated bridge mock, O addition/removal, row deduplication, channel preservation, clipboard 5×14 shape, actual owner connection and the saved 5-booking KPI. Real candidate attendance was not changed for testing.
