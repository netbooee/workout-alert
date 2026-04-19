# iOS Shortcut Setup Guide

This shortcut runs on your iPhone, reads your Apple Health data, and pushes it
to your Netlify app. You can trigger it manually or automate it daily.

---

## What the Shortcut Does

1. Reads today's workouts, weight, step count, and resting heart rate from Health
2. Formats the data as JSON
3. POSTs it to your Netlify app's `/api/sync-health` endpoint

---

## Building the Shortcut

Open the **Shortcuts** app on your iPhone and create a new shortcut with these
actions in order:

### 1 – Get today's workouts
- Action: **Find Health Samples**
- Type: **Workouts**
- Filter: Start Date → is today
- Sort: Start Date, Latest First

### 2 – Get weight
- Action: **Find Health Samples**
- Type: **Body Mass**
- Limit: 1
- Sort: Start Date, Latest First

### 3 – Get step count
- Action: **Find Health Samples**
- Type: **Step Count**
- Filter: Start Date → is today
- Sort: Start Date, Latest First
- *(Steps may come in multiple samples — add them up or take the latest)*

### 4 – Get resting heart rate
- Action: **Find Health Samples**
- Type: **Resting Heart Rate**
- Limit: 1
- Sort: Start Date, Latest First

### 5 – Build the JSON body (Text action)
Paste this template, then tap each placeholder and replace with the
corresponding Shortcut variable from the steps above:

```
{
  "workouts": [
    {
      "type": "[Workout Activity Type]",
      "startDate": "[Start Date]",
      "endDate": "[End Date]",
      "duration": [Duration],
      "calories": [Total Energy Burned],
      "distance": [Total Distance]
    }
  ],
  "weight": {
    "value": [Body Mass Value],
    "unit": "lbs"
  },
  "steps": {
    "count": [Step Count Value]
  },
  "restingHeartRate": {
    "value": [Resting Heart Rate Value]
  },
  "rings": {
    "move": { "current": [Total Energy Burned], "goal": 600 },
    "exercise": { "current": [Exercise Minutes], "goal": 30 },
    "stand": { "current": [Stand Hours], "goal": 12 }
  }
}
```

> **Tip:** For multiple workouts, use a **Repeat with Each** loop and build an
> array. Start simple with one workout first.

### 6 – Send the data
- Action: **Get Contents of URL**
- URL: `https://your-app.netlify.app/api/sync-health`
- Method: **POST**
- Headers:
  - `Content-Type`: `application/json`
  - `x-api-key`: *(your SYNC_API_KEY value)*
- Request Body: **JSON** → paste the Text from step 5

### 7 – (Optional) Show result
- Action: **Show Result** → show the response to confirm success

---

## Automating Daily Sync

1. Go to **Automation** tab in Shortcuts
2. Tap **+** → **Personal Automation** → **Time of Day**
3. Set to e.g. 8:00 PM daily
4. Add action: **Run Shortcut** → select your shortcut
5. Turn off "Ask Before Running"

---

## Testing

After saving, tap **Run** in the shortcut editor. If it works, you'll see
`{"ok":true,"synced":1}` (or however many workouts synced).

Then open your Netlify app — the demo data badge will disappear and your real
workouts will appear.
