(function () {
    'use strict';

    function getRtdb() {
        if (window.rtdb) return window.rtdb;
        if (typeof firebase !== 'undefined' && firebase.database) {
            return firebase.database();
        }
        return null;
    }

    window.RekindleIpBan = {
        async fetchAndCheckIP() {
            const rtdb = getRtdb();
            try {
                const res = await fetch('https://api.ipify.org?format=json');
                const data = await res.json();
                const ip = data.ip;
                const safeIp = ip.replace(/\./g, '-').replace(/:/g, '_');

                if (rtdb) {
                    const snap = await rtdb.ref('banned_ips/' + safeIp).once('value');
                    if (snap.exists()) {
                        return { banned: true, ip: safeIp, rawIp: ip };
                    }
                }
                return { banned: false, ip: safeIp, rawIp: ip };
            } catch (e) {
                console.error("IP Check Failed", e);
                return { banned: false, ip: 'unknown', rawIp: 'unknown' };
            }
        },

        async enforceOnAuthStateChanged(user) {
            if (!user) return;
            const rtdb = getRtdb();
            const ipData = await this.fetchAndCheckIP();
            if (ipData.banned) {
                if (rtdb) {
                    await rtdb.ref('users_private/' + user.uid + '/ipAddress').set(ipData.rawIp).catch(function () { });
                }
                if (window.auth) {
                    await auth.signOut();
                }
                this.showBanMessage("Network Banned", "Your IP address is permanently banned from this network.");
            } else if (ipData.rawIp !== 'unknown' && rtdb) {
                await rtdb.ref('users_private/' + user.uid + '/ipAddress').set(ipData.rawIp).catch(function () { });
            }
        },

        async checkOnLogin() {
            if (typeof firebase === 'undefined' || !firebase.functions) {
                console.warn('Firebase Functions not available, skipping server-side IP check');
                return { banned: false };
            }
            const checkIP = firebase.functions().httpsCallable('checkIPOnLogin');
            const result = await checkIP({});
            return result.data;
        },

        showBanMessage(title, message) {
            if (typeof showGenericModal === 'function') {
                showGenericModal(title, message);
                return;
            }
            if (typeof showAlertModal === 'function') {
                showAlertModal(message, title);
                return;
            }

            // Self-contained fallback modal — never use alert()
            var modalId = 'ip-ban-fallback-modal';
            var modal = document.getElementById(modalId);
            if (!modal) {
                modal = document.createElement('div');
                modal.id = modalId;
                modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:99999;align-items:center;justify-content:center;font-family:sans-serif;';
                modal.innerHTML =
                    '<div id="' + modalId + '-box" style="background:#fff;border:2px solid #000;padding:24px;width:320px;max-width:85%;text-align:center;box-shadow:4px 4px 0 #000;">' +
                    '  <h3 id="' + modalId + '-title" style="margin-top:0;border-bottom:2px solid #000;padding-bottom:10px;font-size:1.1em;"></h3>' +
                    '  <p id="' + modalId + '-msg" style="margin:16px 0;font-size:0.95em;line-height:1.4;"></p>' +
                    '  <button id="' + modalId + '-btn" style="background:#fff;border:2px solid #000;padding:8px 20px;font-weight:bold;cursor:pointer;box-shadow:2px 2px 0 #000;font-size:0.9em;">OK</button>' +
                    '</div>';
                document.body.appendChild(modal);

                var box = document.getElementById(modalId + '-box');
                document.getElementById(modalId + '-btn').onclick = function () {
                    modal.style.display = 'none';
                };
                modal.onclick = function (e) {
                    if (e.target === modal) modal.style.display = 'none';
                };
            }
            document.getElementById(modalId + '-title').textContent = title;
            document.getElementById(modalId + '-msg').textContent = message;
            modal.style.display = 'flex';
        }
    };
})();
