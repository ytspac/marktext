<template>
  <div class="pref-spellchecker">
    <h4>Spelling</h4>
    <compound>
      <template #head>
        <bool
          description="Enable spell checking"
          :bool="spellcheckerEnabled"
          :onChange="handleSpellcheckerEnabled"
        ></bool>
      </template>
      <template #children>
        <bool
          description="Hide marks for spelling errors"
          :bool="spellcheckerNoUnderline"
          :disable="!spellcheckerEnabled"
          :onChange="value => onSelectChange('spellcheckerNoUnderline', value)"
        ></bool>
        <bool
          v-show="isOsx"
          description="Automatically detect document language"
          :bool="true"
          :disable="true"
        ></bool>
        <cur-select
          v-show="!isOsx"
          description="Default language for spell checking"
          :value="spellcheckerLanguage"
          :options="availableDictionaries"
          :disable="!spellcheckerEnabled"
          :onChange="handleSpellcheckerLanguage"
        ></cur-select>
      </template>
    </compound>

    <separator></separator>
    <div
      v-if="isOsx && spellcheckerEnabled"
      class="description"
    >
      The used language will be detected automatically while typing. Additional languages may be added through "Language & Region" in your system preferences pane.
    </div>
    <div
      v-if="isWindows && spellcheckerEnabled"
      class="description"
    >
      Additional languages may be added through "Language" in your "Time & language" settings.
    </div>
  </div>
</template>

<script>
import log from 'electron-log'
import { mapState } from 'vuex'
import Compound from '../common/compound'
import CurSelect from '../common/select'
import Bool from '../common/bool'
import Separator from '../common/separator'
import { isOsx, isWindows, cloneObj } from '@/util'
import { SpellChecker } from '@/spellchecker'
import { getLanguageName, HUNSPELL_DICTIONARY_LANGUAGE_MAP } from '@/spellchecker/languageMap'

export default {
  components: {
    Bool,
    Compound,
    CurSelect,
    Separator
  },
  data () {
    this.isOsx = isOsx
    this.isWindows = isWindows
    this.dictionariesLanguagesOptions = cloneObj(HUNSPELL_DICTIONARY_LANGUAGE_MAP)
    this.hunspellDictionaryDownloadCache = {}
    return {
      availableDictionaries: [],
      errorMessage: ''
    }
  },
  computed: {
    ...mapState({
      spellcheckerEnabled: state => state.preferences.spellcheckerEnabled,
      spellcheckerNoUnderline: state => state.preferences.spellcheckerNoUnderline,
      spellcheckerLanguage: state => state.preferences.spellcheckerLanguage
    })
  },
  created () {
    this.$nextTick(() => {
      this.refreshDictionaryList()
    })
  },
  methods: {
    async getAvailableDictionaries () {
      const dictionaries = await SpellChecker.getAvailableDictionaries()
      return dictionaries.map(item => {
        return {
          value: item,
          label: getLanguageName(item)
        }
      })
    },
    async refreshDictionaryList () {
      this.availableDictionaries = await this.getAvailableDictionaries()
    },
    async ensureDictLanguage (lang) {
      if (!this.spellchecker) {
        this.spellchecker = new SpellChecker(true, 'en-US')
      }
      await this.spellchecker.switchLanguage(lang)
    },

    handleSpellcheckerLanguage (languageCode) {
      this.ensureDictLanguage(languageCode)
        .then(() => {
          this.onSelectChange('spellcheckerLanguage', languageCode)
        })
        .catch(error => {
          // TODO: Notify user via dialog.
          log.error(error)
        })
    },
    handleSpellcheckerEnabled (isEnabled) {
      this.onSelectChange('spellcheckerEnabled', isEnabled)
    },
    onSelectChange (type, value) {
      this.$store.dispatch('SET_SINGLE_PREFERENCE', { type, value })
    }
  }
}
</script>

<style scoped>
  .pref-spellchecker {
    & div.description {
      margin-top: 10px;
      margin-bottom: 2px;
      color: var(--iconColor);
      font-size: 14px;
    }
    & h6.title {
      font-weight: 400;
      font-size: 1.1em;
    }
  }
  .el-table, .el-table__expanded-cell {
    background: var(--editorBgColor);
  }
  .el-table button {
    padding: 1px 2px;
    margin: 5px 10px;
    color: var(--themeColor);
    background: none;
    border: none;
  }
  .el-table button:hover,
  .el-table button:active {
    opacity: 0.9;
    background: none;
    border: none;
  }
  .dictionary-group {
    display: flex;
    & button.el-button {
      height: 30px;
      width: 30px;
      padding: 0;
      margin-left: 6px;
    }

  }
</style>
<style>
  .pref-spellchecker .el-table table {
    margin: 0;
  }
  .pref-spellchecker .el-table th,
  .pref-spellchecker .el-table tr {
    background: var(--editorBgColor);
  }
  .pref-spellchecker .el-table td,
  .pref-spellchecker .el-table th.is-leaf {
    border: 1px solid var(--tableBorderColor);
  }
  .pref-spellchecker .el-table--border::after,
  .pref-spellchecker .el-table--group::after,
  .pref-spellchecker .el-table::before,
  .pref-spellchecker .el-table__fixed-right::before,
  .pref-spellchecker .el-table__fixed::before {
    background: var(--tableBorderColor);
  }
  .pref-spellchecker .el-table__body tr.hover-row.current-row>td,
  .pref-spellchecker .el-table__body tr.hover-row.el-table__row--striped.current-row>td,
  .pref-spellchecker .el-table__body tr.hover-row.el-table__row--striped>td,
  .pref-spellchecker .el-table__body tr.hover-row>td {
    background: var(--selectionColor);
  }

 .pref-spellchecker li.el-select-dropdown__item {
    color: var(--editorColor);
    height: 30px;
  }
  .pref-spellchecker li.el-select-dropdown__item.hover, li.el-select-dropdown__item:hover {
    background: var(--floatHoverColor);
  }
  .pref-spellchecker div.el-select-dropdown {
    background: var(--floatBgColor);
    border-color: var(--floatBorderColor);
    & .popper__arrow {
      display: none;
    }
  }
  .pref-spellchecker input.el-input__inner {
    height: 30px;
    background: transparent;
    color: var(--editorColor);
    border-color: var(--editorColor10);
  }
  .pref-spellchecker .el-input__icon,
  .pref-spellchecker .el-input__inner {
    line-height: 30px;
  }
</style>
