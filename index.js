import {
  extension_settings,
} from "../../../extensions.js";

import {
  characters,
  default_avatar,
  eventSource,
  event_types,
  getThumbnailUrl,
  renderTemplate,
  saveSettingsDebounced
} from "../../../../script.js";

/////

const extensionName = "llamacpp-slot-manager";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName] ||= {};

/////

/**
 * Creates the settings element.
 */
async function createSettings() {
  // Fetch the HTML content of the settings page
  const settingsHtml =
    await $.get(`${extensionFolderPath}/settings.html`);

  // Append the fetched HTML content to the container
  $("#extensions_settings")
    .append(settingsHtml);
}

/**
 * Updates the slot availability values.
 */
function updateSlotsAvailability() {
  // Retrieve slots from extension settings
  const slots = extensionSettings.slots;

  // Initialize variable to count used slots
  let usedSlots = 0;

  // Iterate through each slot and count used slots
  for (const name of Object.values(slots)) {
    // Check if slot is a string (i.e., used)
    if (typeof name === "string") {
      usedSlots++;
    }
  }

  // Update the displayed count of used slots
  $("#slot_manager_slots_used")
    .text(usedSlots);

  // Update the displayed count of available slots
  $("#slot_manager_slots_available")
    .text(slots.length);
}

/**
 * Updates the character list.
 */
function updateCharacterList() {
  // Initialize data object
  const data = {
    characters: [],
  };

  // Iterate through each slot in the extension settings
  for (const [ slot, name ] of Object.entries(extensionSettings.slots)) {
    // Skip if slot is not used
    if (typeof name !== "string") {
      continue;
    }

    // Find character data by name
    const character = characters.find(x => x.name === name);

    // Set default avatar
    let avatar = default_avatar;

    // If character is found and has a valid avatar, update the avatar
    if (character && character.avatar !== "none") {
      avatar = getThumbnailUrl("avatar", character.avatar);
    }

    // Push character data to the characters array
    data.characters.push({
      avatar: avatar,
      name: name,
      slot: slot,
    })
  }

  // Log the data object for debugging purposes
  console.debug(`${extensionName}: Rendering character list`, data);

  // Render HTML using a template with the character data
  const html = renderTemplate(`${extensionFolderPath}/templates/characterList.html`, data, true, true, true);

  // Update the HTML content of the character list container
  $("#slot_manager_character_list")
    .html(html);
}

/**
 * Initializes the slots and slotsUsage arrays with the specified total number of slots.
 * @param {number} totalSlots - The total number of slots to initialize.
 */
function initializeSlots(totalSlots = 2) { // TODO: Instead of hardcoded value, fetch the number of slots from llama.cpp server
  // If arrays is not initialized, initialize it as an empty array
  extensionSettings.slots      ||= [];
  extensionSettings.slotsUsage ||= [];

  // Set the length of the arrays to the total number of slots
  extensionSettings.slots.length      = totalSlots;
  extensionSettings.slotsUsage.length = totalSlots;

  // Log the slots release
  console.debug(`${extensionName}: ${totalSlots} slots available`);

  // Save the updated settings
  saveSettingsDebounced();

  // Update the slots availability to reflect the changes
  updateSlotsAvailability();

  // Update the character list to reflect the changes
  updateCharacterList();
}

/**
 * Acquires a slot for a given cache key, either by mapping it to an existing slot,
 * or by allocating a new slot based on availability or least recent usage.
 * @param {string} cacheKey - The cache key to map to a slot.
 * @returns {number} - The slot associated with the cache key.
 */
function acquireSlot(cacheKey) {  
  /**
   * Allocates a slot for the given cache key.
   * @param {number} index - The index of the slot to allocate.
   * @returns {number} - The allocated slot index.
   */
  const allocateSlot = (index) => {
    // Set the cache key for the slot at the specified index
    extensionSettings.slots[index] = cacheKey;

    // Record the timestamp of slot usage
    extensionSettings.slotsUsage[index] = new Date();

    // Log the slot acquisition
    console.debug(`${extensionName}: Acquiring slot ${index} for ${cacheKey}`);

    // Save the updated settings
    saveSettingsDebounced();

    // Update the slots availability to reflect the changes
    updateSlotsAvailability();

    // Update the character list to reflect the changes
    updateCharacterList();

    // Return the allocated slot index
    return index;
  }

  /**
   * Finds the index of the least recently used slot.
   * @returns {number} - The index of the least recently used slot.
   */
  const findLeastRecentSlotIndex = () => {
    // Initialize variables to track the least recent date and its corresponding index
    let leastRecentDate = Infinity;
    let leastRecentIndex = -1;

    // Iterate through each slot usage date
    extensionSettings.slotsUsage.forEach((date, index) => {
      // Update the least recent date and index if the current date is less than the least recent date
      if (date < leastRecentDate) {
        leastRecentDate = date;
        leastRecentIndex = index;
      }
    });

    // Return the index of the least recently used slot
    return leastRecentIndex;
  }

  // Check if the cache key is already mapped to a slot
  const existingIndex = extensionSettings.slots.findIndex(key => key === cacheKey);
  if (existingIndex !== -1) {
    // If found, allocate the existing slot
    return allocateSlot(existingIndex);
  }

  // Check for the first available slot
  const firstAvailableIndex = extensionSettings.slots.findIndex(key => key === undefined);
  if (firstAvailableIndex !== -1) {
    // If found, allocate the first available slot
    return allocateSlot(firstAvailableIndex);
  }

  // If no available slot is found, allocate the least recently used slot
  const leastRecentIndex = findLeastRecentSlotIndex();
  return allocateSlot(leastRecentIndex);
}

/**
 * Releases the slot at the specified index by deleting it from extension settings
 * and updating related data.
 * @param {number} index - The index of the slot to be released.
 */
function releaseSlot(index) {
  // Delete the slot at the specified index
  delete extensionSettings.slots[index];
  delete extensionSettings.slotsUsage[index];

  // Log the slot release
  console.debug(`${extensionName}: Releasing slot ${index}`);

  // Save the updated settings
  saveSettingsDebounced();

  // Update the slots availability to reflect the changes
  updateSlotsAvailability();

  // Update the character list to reflect the changes
  updateCharacterList();
}

/**
 * Releases all slots by resetting them to undefined in extension settings
 * and updating related data.
 */
function releaseSlots() {
  // Reset all slots to undefined
  extensionSettings.slots.fill(undefined);
  extensionSettings.slotsUsage.fill(undefined);

  // Log the slots release
  console.debug(`${extensionName}: Releasing all slots`);

  // Save the updated settings
  saveSettingsDebounced();

  // Update the slots availability to reflect the changes
  updateSlotsAvailability();

  // Update the character list to reflect the changes
  updateCharacterList();
}

/////

jQuery(async () => {
  // Create settings page
  await createSettings();

  // Click handlers
  {
    $("#slot_manager_settings")
      .on("click", ".slot_manager_update_count", (event) => initializeSlots());

    $("#slot_manager_settings")
      .on("click", ".slot_manager_release", (event) => releaseSlot(Number(event.currentTarget.dataset.slot)));

    $("#slot_manager_settings")
      .on("click", ".slot_manager_release_all", (event) => releaseSlots());
  }

  // Events
  {
    let currentSlot = null;

    /////

    eventSource.on(event_types.APP_READY, () => {
      initializeSlots();
    });

    eventSource.on(event_types.GENERATE_BEFORE_COMBINE_PROMPTS, (data) => {
      currentSlot = acquireSlot(data.char);
    });

    eventSource.on(event_types.TEXT_COMPLETION_SETTINGS_READY, (params) => {
      params["id_slot"] = currentSlot;
    });
  }
});
