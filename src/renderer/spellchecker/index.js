import { ipcRenderer, webFrame } from 'electron'
import { deepClone, isOsx } from '@/util'

// Source: https://github.com/Microsoft/vscode/blob/master/src/vs/editor/common/model/wordHelper.ts
// /(-?\d*\.\d\w*)|([^\`\~\!\@\#\$\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/
/* eslint-disable no-useless-escape */
const WORD_SEPARATORS = /(?:[`~!@#$%^&*()-=+[{\]}\\|;:'",\.<>\/?\s])/g
const WORD_DEFINITION = /(?:-?\d*\.\d\w*)|(?:[^`~!@#$%^&*()-=+[{\]}\\|;:'",\.<>\/?\s]+)/g
/* eslint-enable no-useless-escape */

/**
 * Translate a left and right offset from a word in `line` into a cursor with
 * the given line cursor.
 *
 * @param {*} lineCursor The original line cursor.
 * @param {number} left Start offset/index of word in `lineCursor`.
 * @param {number} right End offset/index of word in `lineCursor`.
 * @returns {*} Return a cursor of the word selected in `lineCursor`(e.g.
 *              "foo >bar< foo" where `>`/`<` start and end offset).
 */
export const offsetToWordCursor = (lineCursor, left, right) => {
  // Deep clone cursor start and end
  const start = deepClone(lineCursor.start)
  const end = deepClone(lineCursor.end)
  start.offset = left
  end.offset = right
  return { start, end }
}

/**
 * Validate whether the selection is valid for spelling correction.
 *
 * @param {*} selection The preview editor selection range.
 */
export const validateLineCursor = selection => {
  // Validate selection range.
  if (!selection && !selection.start && !selection.start.hasOwnProperty('offset') &&
    !selection.end && !selection.end.hasOwnProperty('offset')) {
    return false
  }

  // Allow only single lines
  const { start: startCursor, end: endCursor } = selection
  if (startCursor.key !== endCursor.key || !startCursor.block) {
    return false
  }

  // Don't correct words in code blocks or editors for HTML, LaTex and diagrams.
  if (startCursor.block.functionType === 'codeContent' &&
    startCursor.block.lang !== undefined) {
    return false
  }

  // Don't correct words in code blocks or pre elements such as language identifier.
  if (selection.affiliation && selection.affiliation.length === 1 &&
    selection.affiliation[0].type === 'pre') {
    return false
  }
  return true
}

/**
 * High level spell checker API based on Chromium built-in spell checker.
 */
export class SpellChecker {
  /**
   * ctor
   *
   * @param {boolean} enabled Whether spell checking is enabled in settings.
   */
  constructor (enabled = true, lang) {
    this.enabled = enabled
    this.currentSpellcheckerLanguage = lang

    // Helper to forbid the usage of the spell checker (e.g. failed to create native spell checker),
    // even if spell checker is enabled in settings.
    this.isProviderAvailable = true
  }

  /**
   * Whether the spell checker is available and enabled.
   */
  get isEnabled () {
    return this.isProviderAvailable && this.enabled
  }

  /**
   * Enable the spell checker and sets `lang` or tries to find a fallback.
   *
   * @param {string} lang The language to set.
   * @returns {Promise<boolean>}
   */
  async activateSpellchecker (lang) {
    try {
      this.enabled = true
      this.isProviderAvailable = true
      const success = await this.switchLanguage(lang || this.currentSpellcheckerLanguage)
      return success
    } catch (error) {
      this.deactivateSpellchecker()
      throw error
    }
  }

  /**
   * Disables the native spell checker.
   */
  deactivateSpellchecker () {
    this.enabled = false
    this.isProviderAvailable = false
    ipcRenderer.send('mt::spellchecker-set-enabled', false)
  }

  /**
   * Add a word to the user dictionary.
   *
   * @param {string} word The word to add.
   * @returns {Promise<boolean>} Whether the word was added.
   *
   */
  async addToDictionary (word) {
    if (!this.isEnabled) {
      return false
    }
    return ipcRenderer.invoke('mt::spellchecker-add-word', word)
  }

  /**
   * Remove a word frome the user dictionary.
   *
   * @param {string} word The word to remove.
   * @returns {Promise<boolean>} Whether the word was removed.
   */
  async removeFromDictionary (word) {
    if (!this.isEnabled) {
      return false
    }
    return ipcRenderer.invoke('mt::spellchecker-remove-word', word)
  }

  /**
   * Ignore a word for the current runtime.
   *
   * @param {string} word The word to ignore.
   */
  ignoreWord (word) {
    // TODO(spell): No longer needed because we cannot manipulate Chromiums spell checker. Remove this.
    return false
  }

  /**
   * Return the current language.
   */
   get lang () {
    if (this.isEnabled) {
      return this.currentSpellcheckerLanguage
    }
    return ''
  }

  set lang (lang) {
    this.currentSpellcheckerLanguage = lang
  }

  /**
   * Explicitly switch the language to a specific language.
   *
   * NOTE: This function can throw an exception.
   *
   * @param {string} lang The language code
   * @returns {Promise<boolean>} Return the language on success or null.
   */
  async switchLanguage (lang) {
    if (isOsx) {
      // NB: On macOS the OS spell checker is used and will detect the language automatically.
      return true
    } else if (!lang) {
      throw new Error('Invalid empty language.')
    } else if (this.isEnabled) {
      const errorMsg = await ipcRenderer.invoke('mt::spellchecker-switch-language', lang)
      if (errorMsg) {
        throw new Error(errorMsg)
      }
      this.lang = lang
      return true
    }
    return false
  }

  /**
   * Is the given word misspelled.
   *
   * @param {string} word The word to check.
   */
  isMisspelled (word) {
    // TODO(spell): Move to main because `webFrame.getWordSuggestions` and `webFrame.isWordMisspelled`
    //              doesn't work on Windows (Electron#28684). Remove this.
    if (this.isEnabled) {
      return webFrame.isWordMisspelled(word)
    }
    return false
  }

  /**
   * Get corrections.
   *
   * @param {string} word The word to get suggestion for.
   * @returns {Promise<string[]>} An array of suggestions.
   */
  async getWordSuggestion (word) {
    // TODO(spell): Move to main because `webFrame.getWordSuggestions` and `webFrame.isWordMisspelled`
    //              doesn't work on Windows (Electron#28684). Remove this.
    if (this.isEnabled) {
      return webFrame.getWordSuggestions(word)
    }
    return []
  }

  /**
   * Returns a list of available dictionaries.
   * @returns {Promise<string[]>} Available dictionary languages.
   */
   static async getAvailableDictionaries () {
    if (isOsx) {
      // NB: On macOS the OS spell checker is used and will detect the language automatically.
      return []
    }
    return ipcRenderer.invoke('mt::spellchecker-get-available-dictionaries')
  }

  /**
   * Extract the word at the given offset from the text.
   *
   * @param {string} text Text
   * @param {number} offset Normalized cursor offset (e.g. ab<cursor>c def --> 2)
   */
  static extractWord (text, offset) {
    if (!text || text.length === 0) {
      return null
    } else if (offset < 0) {
      offset = 0
    } else if (offset >= text.length) {
      offset = text.length - 1
    }

    // Matches all words starting at a good position.
    WORD_DEFINITION.lastIndex = text.lastIndexOf(' ', offset - 1) + 1
    let match = null
    let left = -1
    while (match = WORD_DEFINITION.exec(text)) { // eslint-disable-line
      if (match && match.index <= offset) {
        if (WORD_DEFINITION.lastIndex > offset) {
          left = match.index
        }
      } else {
        break
      }
    }
    WORD_DEFINITION.lastIndex = 0

    // Cursor is between two word separators (e.g "*<cursor>*" or " <cursor>*")
    if (left <= -1) {
      return null
    }

    // Find word ending.
    WORD_SEPARATORS.lastIndex = offset
    match = WORD_SEPARATORS.exec(text)
    let right = -1
    if (match) {
      right = match.index
    }
    WORD_SEPARATORS.lastIndex = 0

    // The last word in the string is a special case.
    if (right < 0) {
      return {
        left,
        right: text.length,
        word: text.slice(left)
      }
    }
    return {
      left,
      right: right,
      word: text.slice(left, right)
    }
  }
}
