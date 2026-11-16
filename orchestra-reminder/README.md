# Orchestra Reminder

Orchestra Reminder helps you keep track of the orchestras you have played and reminds you when it is time to play another tanda by a particular orchestra.

## Install

1. Download the plugin files and extract them if needed.
2. Open your TangoDJ data folder, then open or create its `plugins` folder.
3. Copy the entire `orchestra-reminder` folder into `plugins`. The file `index.html` should be directly inside `plugins/orchestra-reminder/`.
4. In TangoDJ, open **Settings → Plugin panels**, click **Refresh**, and enable **orchestra-reminder**.

The default TangoDJ data folder is:

- **macOS:** `~/Library/Application Support/com.bukdugroup.tangodj/`
- **Windows:** `%APPDATA%\com.bukdugroup.tangodj\`

If you changed TangoDJ’s data location, use that folder instead.

## Set up reminders

1. In **Orchestra settings**, click **+ Add orchestra**.
2. Enter an orchestra name and how often you want to play it, in minutes. New cards start at **60 minutes**.
3. Repeat for each orchestra, then click **Save settings**.

You can enter a full name or part of a name. Matching ignores letter case: `sarli` matches `Carlos Di Sarli`.

To remove an orchestra, hover over its card and click the trash icon at the top right, then save. The icon also appears when using the keyboard to focus a card’s controls. Settings stay visible after saving.

## Read the reminders

- **Last played** shows elapsed minutes, such as **12 min ago**. **Not played** means the plugin has not recorded a tanda by that orchestra in the current history.
- **Threshold** is the number of minutes you set for that orchestra.
- **Due** is highlighted when the threshold is reached or the orchestra has not been played. Due orchestras appear first.
- **Recently played** means the threshold has not been reached yet.
- **Tandas so far** lists the recorded tandas, their orchestras and singers, and when they started. The list automatically scrolls to each newly played tanda. Hover over a time to see its full date and time.

Reminders continue counting during pauses and after playback stops. The plugin reminds you; it does not change your playlist or start playback.

## Playback and saved settings

Keep the plugin enabled while playing a playlist on the main player. It records tandas from the time it starts watching playback, so it cannot fill in tandas played while it was disabled. If enabled halfway through a tanda, it records that time as the start.

Songs within one tanda and pausing/resuming keep the original start time. Replaying a tanda after moving to another one adds a new history entry. Cortinas are excluded. Switching the playing playlist starts a new history; browsing other lists or using the preview player does not.

Your saved orchestra settings and history are remembered between sessions. Keep the installed folder named `orchestra-reminder` when updating.

Use the **…** button in the panel header to dock, float, maximize, or restore it. **Hide** keeps it running; **Disable** stops it.

## Update

1. Quit TangoDJ.
2. Replace the files inside the existing `plugins/orchestra-reminder/` folder with the downloaded files.
3. Reopen TangoDJ. If necessary, enable the plugin in **Settings → Plugin panels**.

## Troubleshooting

- **The plugin is missing from the list:** check that `index.html` is directly inside `plugins/orchestra-reminder/`, then click **Refresh** in Plugin panels.
- **No tandas appear:** play a playlist on the main player and make sure the plugin is enabled. Earlier tandas are not added automatically.
- **An error appears:** read the message in the panel and check TangoDJ’s Logs for more details.
