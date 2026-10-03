/*
   This file is part of Caffeine (gnome-shell-extension-caffeine).

   Caffeine is free software: you can redistribute it and/or modify it under the terms of
   the GNU General Public License as published by the Free Software Foundation, either
   version 3 of the License, or (at your option) any later version.

   Caffeine is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
   without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
   See the GNU General Public License for more details.

   You should have received a copy of the GNU General Public License along with Caffeine.
   If not, see <https://www.gnu.org/licenses/>.

   Copyright 2024 Pakaoraki

   // From https://gitlab.com/skrewball/openweather/-/blob/master/src/prefs.js
*/

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';

import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const TIMERS_DURATION = [
    ['05', '10', '30'],
    ['10', '20', '45'],
    ['15', '30', '60'],
    ['20', '40', '75'],
    ['30', '50', '80']
];

export var TimerPage = GObject.registerClass(
class CaffeineTimerPage extends Adw.PreferencesPage {
    _init(settings, settingsKey) {
        super._init({
            title: _('Timer'),
            icon_name: 'stopwatch-symbolic',
            name: 'TimerPage'
        });
        this._settings = settings;
        this._settingsKey = settingsKey;

        // Timer group
        // --------------
        const timerGroup = new Adw.PreferencesGroup({
            title: _('Preset durations')
        });

        // Slider
        const durationIndex = this._settings.get_int(this._settingsKey.DURATION_TIMER_INDEX);
        this.timerOptionRow = new Adw.ActionRow({
            title: _('Durations'),
            activatable: true
        });

        const adjustSliderTimer = new Gtk.Adjustment({
            lower: 0,
            upper: 4,
            step_increment: 0.1,
            page_increment: 1,
            value: durationIndex
        });

        this.sliderTimer = new Gtk.Scale({
            valign: 'center',
            hexpand: true,
            width_request: '200px',
            round_digits: false,
            draw_value: false,
            orientation: 'horizontal',
            digits: 0,
            adjustment: adjustSliderTimer
        });
        for (let index = 0; index < 5; index++) {
            this.sliderTimer.add_mark(index, Gtk.PositionType.BOTTOM, null);
        }
        this.timerOptionRow.add_suffix(this.sliderTimer);

        // Add elements
        timerGroup.add(this.timerOptionRow);
        this.add(timerGroup);

        // Custom value group
        // --------------
        this.resetCustomTimerButton = new Gtk.Button({
            icon_name: 'view-refresh-symbolic',
            valign: Gtk.Align.CENTER,
            hexpand: false,
            vexpand: false
        });

        const customDurationGroup = new Adw.PreferencesGroup({
            title: _('Custom durations'),
            header_suffix: this.resetCustomTimerButton
        });

        // Custom value Adw.spinRow
        const maxValueSecond = 359940; // = 99 Hours, 99 minutes
        const variantDuration = this._settings.get_value(this._settingsKey.DURATION_TIMER_LIST);
        const durationValues = variantDuration.deepUnpack();
        this.shortTimerSelector = this.timerSpinRow(_('Short timer'),
            60,
            durationValues[0], // Short duration
            60,
            maxValueSecond - 60 * 2);
        this.mediumTimerSelector = this.timerSpinRow(_('Medium timer'),
            60,
            durationValues[1], // Medium duration
            60 * 2,
            maxValueSecond - 60);
        this.longTimerSelector = this.timerSpinRow(_('Long timer'),
            60,
            durationValues[2], // Long duration
            60 * 3,
            maxValueSecond);

        // Enable / Disable Custom value
        this.enableCustomTimerRow = new Adw.SwitchRow({
            title: _('Enable custom values'),
            subtitle: _('Select custom value for each duration'),
            active: this._settings.get_boolean(this._settingsKey.USE_CUSTOM_DURATION)
        });

        // Add elements
        customDurationGroup.add(this.enableCustomTimerRow);
        customDurationGroup.add(this.shortTimerSelector);
        customDurationGroup.add(this.mediumTimerSelector);
        customDurationGroup.add(this.longTimerSelector);
        this.add(customDurationGroup);

        // Init
        this._activeCustomvalue();
        this._updateTimerDuration(durationIndex);
        this._updateResetButtonState();

        // Bind signals
        // --------------
        this.enableCustomTimerRow.connect('notify::active', (widget) => {
            this._settings.set_boolean(this._settingsKey.USE_CUSTOM_DURATION, widget.get_active());
            this._activeCustomvalue();
        });
        this.sliderTimer.connect('change-value',
            (widget) => this._updateTimerDuration(widget.get_value()));
        this.resetCustomTimerButton.connect('clicked', () => {
            this._updateCustomDurationFromIndex(this.sliderTimer.get_value());
        });
        this.shortTimerSelector.connect('notify::value', (widget) => {
            this._updateDurationVarian(widget.get_value(), 0);
            this._updateResetButtonState();
            // Control hierarchy of custom duration
            const shortValue = this.shortTimerSelector.get_value();
            const mediumValue = this.mediumTimerSelector.get_value();
            if (shortValue >= mediumValue) {
                this.mediumTimerSelector.set_value(shortValue + 60);
            }
        });
        this.mediumTimerSelector.connect('notify::value', (widget) => {
            this._updateDurationVarian(widget.get_value(), 1);
            this._updateResetButtonState();
            // Control hierarchy of custom duration
            const shortValue = this.shortTimerSelector.get_value();
            const mediumValue = this.mediumTimerSelector.get_value();
            const longValue = this.longTimerSelector.get_value();
            if (mediumValue <= shortValue) {
                this.shortTimerSelector.set_value(mediumValue - 60);
            }
            if (mediumValue >= longValue) {
                this.longTimerSelector.set_value(mediumValue + 60);
            }
        });
        this.longTimerSelector.connect('notify::value', (widget) => {
            this._updateDurationVarian(widget.get_value(), 2);
            this._updateResetButtonState();
            // Control hierarchy of custom duration
            const mediumValue = this.mediumTimerSelector.get_value();
            const longValue = this.longTimerSelector.get_value();
            if (longValue <= mediumValue) {
                this.mediumTimerSelector.set_value(longValue - 60);
            }
        });
    }

    _isCustomValueSet() {
        const selectors = [this.shortTimerSelector, this.mediumTimerSelector, this.longTimerSelector];
        const durationIndex = this.sliderTimer.get_value();
        let isCustom = false;
        for (const [i, selector] of selectors.entries()) {
            if (selector.get_value() !== parseInt(TIMERS_DURATION[durationIndex][i]) * 60) {
                isCustom = true;
                break;
            }
        }
        return isCustom;
    }

    _updateTimerDuration(value) {
        const durationIndex = this._settings.get_int(this._settingsKey.DURATION_TIMER_INDEX);
        this.timerOptionRow.set_subtitle(_('Set to ') +
            TIMERS_DURATION[value][0] + ', ' +
            TIMERS_DURATION[value][1] + ', ' +
            TIMERS_DURATION[value][2] + _(' minutes'));
        if (durationIndex !== value) {
            this._settings.set_int(this._settingsKey.DURATION_TIMER_INDEX, value);
        }
        if (!this._settings.get_boolean(this._settingsKey.USE_CUSTOM_DURATION)) {
            this._updateCustomDurationFromIndex(value);
        }
    }

    _updateDurationVarian(value, index) {
        const variantDuration = this._settings.get_value(this._settingsKey.DURATION_TIMER_LIST);
        const currentDurationValues = variantDuration.deepUnpack();
        currentDurationValues[index] = value;
        const newVariant = new GLib.Variant('ai', currentDurationValues);
        this._settings.set_value(this._settingsKey.DURATION_TIMER_LIST, newVariant);
    }

    _updateCustomDurationFromIndex(value) {
        this.shortTimerSelector.set_value(TIMERS_DURATION[value][0] * 60);
        this.mediumTimerSelector.set_value(TIMERS_DURATION[value][1] * 60);
        this.longTimerSelector.set_value(TIMERS_DURATION[value][2] * 60);
    }

    _updateResetButtonState() {
        if (this._isCustomValueSet()) {
            this.resetCustomTimerButton.visible = true;
        } else {
            this.resetCustomTimerButton.visible = false;
        }
    }

    _activeCustomvalue() {
        if (this._settings.get_boolean(this._settingsKey.USE_CUSTOM_DURATION)) {
            this.timerOptionRow.set_sensitive(false);
            this.shortTimerSelector.set_sensitive(true);
            this.mediumTimerSelector.set_sensitive(true);
            this.longTimerSelector.set_sensitive(true);
        } else {
            this.timerOptionRow.set_sensitive(true);
            this.shortTimerSelector.set_sensitive(false);
            this.mediumTimerSelector.set_sensitive(false);
            this.longTimerSelector.set_sensitive(false);
            this._updateTimerDuration(this.sliderTimer.get_value());
        }
    }

    timerSpinRow(name, step, value, minValue, maxValue) {
        return new DurationRow(name, new Gtk.Adjustment({
            lower: minValue,
            upper: maxValue,
            step_increment: step,
            value
        }));
    }
});

const DURATION_PATTERN = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/;

function formatDuration(seconds) {
    return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
        .map((n) => n.toString().padStart(2, '0')).join(':');
}

/*
 * A row editing a duration as HH:MM:SS, with buttons stepping it by the
 * adjustment's step. Not an Adw.SpinRow: its output signal can format the
 * text, but its input signal hands the parsed value back through an out
 * argument that gjs cannot set, so typed times cannot be read through its
 * public API.
 */
const DurationRow = GObject.registerClass({
    Properties: {
        'value': GObject.ParamSpec.double('value', null, null,
            GObject.ParamFlags.READWRITE, 0, Number.MAX_SAFE_INTEGER, 0)
    }
}, class DurationRow extends Adw.ActionRow {
    _init(title, adjustment) {
        super._init({ title });

        this._adjustment = adjustment;
        this._entry = new Gtk.Entry({
            valign: Gtk.Align.CENTER,
            max_width_chars: 8,
            max_length: 8,
            xalign: 1
        });
        this._lessButton = new Gtk.Button({
            icon_name: 'list-remove-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat', 'circular']
        });
        this._moreButton = new Gtk.Button({
            icon_name: 'list-add-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat', 'circular']
        });
        this.add_suffix(this._entry);
        this.add_suffix(this._lessButton);
        this.add_suffix(this._moreButton);

        this._lessButton.connect('clicked', () =>
            this.set_value(this.get_value() - adjustment.step_increment));
        this._moreButton.connect('clicked', () =>
            this.set_value(this.get_value() + adjustment.step_increment));

        // A complete time applies as it is typed; leaving the entry or
        // pressing Enter puts the text back in shape
        this._entry.connect('changed', () => this._applyText());
        this._entry.connect('activate', () => this._sync());
        const focusController = new Gtk.EventControllerFocus();
        focusController.connect('leave', () => this._sync());
        this._entry.add_controller(focusController);

        adjustment.connect('value-changed', () => {
            this._sync();
            this.notify('value');
        });
        this._sync();
    }

    get value() {
        return this._adjustment.get_value();
    }

    set value(value) {
        // Whole steps, as the duration list holds whole minutes
        const step = this._adjustment.step_increment;
        this._adjustment.set_value(Math.round(value / step) * step);
    }

    get_value() {
        return this.value;
    }

    set_value(value) {
        this.value = value;
    }

    _applyText() {
        const match = DURATION_PATTERN.exec(this._entry.get_text());
        if (!match) {
            return;
        }

        const [, hours, minutes, seconds] = match.map(Number);
        this._typing = true;
        this.set_value(hours * 3600 + minutes * 60 + seconds);
        this._typing = false;
    }

    _sync() {
        const value = this.get_value();
        if (!this._typing) {
            this._entry.set_text(formatDuration(value));
        }
        this._lessButton.sensitive = value > this._adjustment.lower;
        this._moreButton.sensitive = value < this._adjustment.upper;
    }
});
