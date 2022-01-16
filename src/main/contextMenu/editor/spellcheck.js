import { MenuItem } from 'electron'
import log from 'electron-log'
import { isOsx } from '../../config'
import { addToDictionary, getCustomDictionaryWords } from '../../spellchecker'
import { SEPARATOR } from './menuItems'

/**
 * Build the spell checker menu depending on input.
 *
 * @param {boolean} isMisspelled Whether a the selected word is misspelled.
 * @param {[string]} misspelledWord The selected word.
 * @param {[string[]]} wordSuggestions Suggestions for `selectedWord`.
 * @returns {MenuItem[]}
 */
export default (isMisspelled, misspelledWord, wordSuggestions) => {
  const spellingSubmenu = []

  spellingSubmenu.push(new MenuItem({
    label: 'Change Language...',
    // NB: On macOS the OS spell checker is used and will detect the language automatically.
    visible: !isOsx,
    click (menuItem, targetWindow) {
      targetWindow.webContents.send('mt::spelling-show-switch-language')
    }
  }))

  // Handle misspelled word if wordSuggestions is set, otherwise word is correct.
  if (isMisspelled && misspelledWord && wordSuggestions) {
    spellingSubmenu.push({
      label: 'Add to Dictionary',
      click (menuItem, targetWindow) {
        if (!addToDictionary(targetWindow, misspelledWord)) {
          log.error(`Error while adding "${misspelledWord}" to dictionary.`)
          return
        }
        // Need to notify Chromium to invalidate the spelling underline.
        targetWindow.webContents.replaceMisspelling(misspelledWord)
      }
    })

    if (wordSuggestions.length > 0) {
      spellingSubmenu.push(SEPARATOR)
      for (const word of wordSuggestions) {
        spellingSubmenu.push({
          label: word,
          click (menuItem, targetWindow) {
            targetWindow.webContents.send('mt::spelling-replace-misspelling', {
              word: misspelledWord,
              replacement: word
            })
          }
        })
      }
    }
  } else {
    spellingSubmenu.push({
      label: 'Edit Dictionary...',
      click (menuItem, targetWindow) {
        // TODO(spell): Need to add another view to show and remove words from spell checker.
        //              Chromium doesn't select the word if isn't misspelled and we cannot
        //              get the word to remove.
        //   -> Command or Settings
        getCustomDictionaryWords(targetWindow)
          .then(words => console.log(words))
          .catch(error => console.error(error))
      }
    })
  }
  return spellingSubmenu
}
