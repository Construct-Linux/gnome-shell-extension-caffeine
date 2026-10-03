import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const MPRIS_NAMESPACE = 'org.mpris.MediaPlayer2';

const DBusMprisPlayerInterface = `<node>
  <interface name="org.mpris.MediaPlayer2.Player">
    <property name="PlaybackStatus" type="s" access="read"/>
  </interface>
</node>`;

const MprisPlayerProxy = Gio.DBusProxy.makeProxyWrapper(DBusMprisPlayerInterface);

/**
 * Follows the session's MPRIS players and reports whether any is playing.
 */
export class MprisWatcher {
    /**
     * @param {(isPlaying: boolean) => void} onChanged Called when the answer changes
     */
    constructor(onChanged) {
        this._onChanged = onChanged;
        this._isPlaying = false;
        this._cancellable = new Gio.Cancellable();

        /** @type {Map<string, {proxy: Gio.DBusProxy, handlerId: number}>} */
        this._players = new Map();

        // The bus only sends the owner changes of names in the MPRIS
        // namespace, rather than every name change of the session.
        this._subscriptionId = Gio.DBus.session.signal_subscribe(
            'org.freedesktop.DBus', 'org.freedesktop.DBus', 'NameOwnerChanged',
            '/org/freedesktop/DBus', MPRIS_NAMESPACE,
            Gio.DBusSignalFlags.MATCH_ARG0_NAMESPACE,
            (_connection, _sender, _path, _iface, _signal, params) => {
                const [name, oldOwner, newOwner] = params.deepUnpack();
                if (newOwner === '') {
                    this._removePlayer(name);
                } else if (oldOwner === '') {
                    this._addPlayer(name);
                }
                this._update();
            });

        Gio.DBus.session.call('org.freedesktop.DBus', '/org/freedesktop/DBus',
            'org.freedesktop.DBus', 'ListNames', null, new GLib.VariantType('(as)'),
            Gio.DBusCallFlags.NONE, -1, this._cancellable, (connection, res) => {
                let names;
                try {
                    [names] = connection.call_finish(res).deepUnpack();
                } catch (e) {
                    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                        logError(e, 'Listing the MPRIS players');
                    }
                    return;
                }

                names.forEach((name) => this._addPlayer(name));
                this._update();
            });
    }

    get isPlaying() {
        return this._isPlaying;
    }

    _addPlayer(name) {
        if (!name.startsWith(`${MPRIS_NAMESPACE}.`) || this._players.has(name)) {
            return;
        }

        const proxy = new MprisPlayerProxy(Gio.DBus.session, name,
            '/org/mpris/MediaPlayer2', (_proxy, error) => {
                if (error) {
                    if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                        logError(error, `MPRIS player ${name}`);
                    }
                    return;
                }
                this._update();
            }, this._cancellable);
        const handlerId = proxy.connect('g-properties-changed', () => this._update());
        this._players.set(name, { proxy, handlerId });
    }

    _removePlayer(name) {
        const player = this._players.get(name);
        if (!player) {
            return;
        }

        player.proxy.disconnect(player.handlerId);
        this._players.delete(name);
    }

    _update() {
        const isPlaying = [...this._players.values()].some(
            ({ proxy }) => proxy.PlaybackStatus === 'Playing');
        if (isPlaying === this._isPlaying) {
            return;
        }

        this._isPlaying = isPlaying;
        this._onChanged(isPlaying);
    }

    destroy() {
        this._cancellable.cancel();
        Gio.DBus.session.signal_unsubscribe(this._subscriptionId);
        for (const name of [...this._players.keys()]) {
            this._removePlayer(name);
        }
    }
}
