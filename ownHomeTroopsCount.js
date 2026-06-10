// ── GitHub dispatch config ────────────────────────────────────────────────────
const GITHUB_OWNER = 'pronglers';  
const GITHUB_REPO  = 'tw-tropas';
const GITHUB_PAT   = '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'
// ─────────────────────────────────────────────────────────────────────────────

if (typeof villagesTroopsCounter !== 'undefined') {
    villagesTroopsCounter.init();
} else {

class VillagesTroopsCounter {
    static VillagesTroopsCounterTranslations() {
        return {
            en_US: {
                title: 'Home and Scavenging Troops Counter',
                home: 'Home',
                scavenging: 'Scavenging',
                total: 'Total',
                errorMessages: {
                    premiumRequired: 'Error. A premium account is required to run this script!',
                    errorFetching: 'An error occured while trying to fetch the following URL:',
                    missingSavengeMassScreenElement: 'An error occurred trying to located the ScavengeMassScreen element inside the mass scavenge page.'
                },
                successMessage: 'Loaded successfully!',
                loadingMessage: 'Loading...',
                loadingWorldConfigMessage: 'Loading world config...',
            },
            pt_PT: {
                title: 'Contador de tropas em casa e em buscas',
                home: 'Em casa',
                scavenging: 'Em busca',
                total: 'Total',
                errorMessages: {
                    premiumRequired: 'Erro. É necessário possuir conta premium para correr este script!',
                    errorFetching: 'Ocorreu um erro ao tentar carregar o seguinte URL:',
                    missingSavengeMassScreenElement: 'Ocorreu um erro ao tentar localizar o elemento ScavengeMassScreen dentro da página de buscas em massa.'
                },
                successMessage: 'Carregado com sucesso!',
                loadingMessage: 'A carregar...',
                loadingWorldConfigMessage: 'A carregar configurações do mundo...',
            }
        };
    }

    constructor() {
        this.UserTranslation = game_data.locale in VillagesTroopsCounter.VillagesTroopsCounterTranslations() ? this.UserTranslation = VillagesTroopsCounter.VillagesTroopsCounterTranslations()[game_data.locale] : VillagesTroopsCounter.VillagesTroopsCounterTranslations().en_US;
        this.availableSupportUnits = Object.create(game_data.units);
        this.availableSupportUnits = Object.getPrototypeOf(this.availableSupportUnits);
        this.availableSupportUnits.splice(this.availableSupportUnits.indexOf('militia'), 1);
        this.worldConfig = null;
        this.isScavengingWorld = false;
        this.worldConfigFileName = `worldConfigFile${game_data.world}`;
    }

    async init() {
        if (!game_data.features.Premium.active) {
            UI.ErrorMessage(this.UserTranslation.errorMessages.premiumRequired);
            return;
        }
        await this.#initWorldConfig();
        this.#createUI();
    }

    async #initWorldConfig() {
        var worldConfig = localStorage.getItem(this.worldConfigFileName);
        if (worldConfig === null) {
            UI.InfoMessage(this.UserTranslation.loadingWorldConfigMessage);
            worldConfig = await this.#getWorldConfig();
        }
        this.worldConfig = $.parseXML(worldConfig);
        this.isScavengingWorld = this.worldConfig.getElementsByTagName('config')[0].getElementsByTagName('game')[0].getElementsByTagName('scavenging')[0].textContent.trim() === "1";
    }

    async #getWorldConfig() {
        var Xml = this.#fetchHtmlPage('/interface.php?func=get_config');
        localStorage.setItem(this.worldConfigFileName, (new XMLSerializer()).serializeToString(Xml));
        await this.#waitMilliseconds(Date.now(), 200);
        return Xml;
    }

    async #waitMilliseconds(lastRunTime, milliseconds = 0) {
        await new Promise(res => setTimeout(res, Math.max(lastRunTime + milliseconds - Date.now(), 0)));
    }

    #generateUrl(screen, mode = null, extraParams = {}) {
        var url = `/game.php?village=${game_data.village.id}&screen=${screen}`;
        if (mode !== null) url += `&mode=${mode}`;
        $.each(extraParams, function (key, value) {
            url += `&${key}=${value}`;
        });
        if (game_data.player.sitter !== "0") url += "&t=" + game_data.player.id;
        return url;
    }

    #initTroops() {
        var troops = {};
        this.availableSupportUnits.forEach(function(unit) {
            troops[unit] = 0;
        });
        return troops;
    }

    #fetchHtmlPage(url) {
        var temp_data = null;
        $.ajax({
            async: false,
            url: url,
            type: 'GET',
            success: function(data) {
                temp_data = data;
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.log(jqXHR);
            }
        });
        return temp_data;
    }

    async #getTroopsScavengingWorldObj() {
        var troopsObj = {
            'villagesTroops': this.#initTroops(),
            'scavengingTroops': this.#initTroops(),
            'perVillage': []
        };

        var currentPage = 0;
        var lastRunTime = null;
        do {
            var scavengingObject = await getScavengeMassScreenJson(this, currentPage, lastRunTime);
            if (!scavengingObject) break;
            if (scavengingObject.length === 0) break;
            lastRunTime = Date.now();

            $.each(scavengingObject, function(id, villageData) {
                var villageTroops = {};
                $.each(villageData.unit_counts_home, function(key, value) {
                    if (key !== 'militia') {
                        villageTroops[key] = value;
                        troopsObj.villagesTroops[key] += value;
                    }
                });
                troopsObj.perVillage.push({
                    name: villageData.village_name,
                    troops: villageTroops
                });

                $.each(villageData.options, function(id, option) {
                    if (option.scavenging_squad !== null) {
                        $.each(option.scavenging_squad.unit_counts, function(key, value) {
                            if (key !== 'militia') troopsObj.scavengingTroops[key] += value;
                        });
                    }
                });
            });
            currentPage++;
        } while(true);

        return troopsObj;

        async function getScavengeMassScreenJson(currentObj, currentPage = 0, lastRunTime = 0) {
            await currentObj.#waitMilliseconds(lastRunTime, 200);
            var html = currentObj.#fetchHtmlPage(currentObj.#generateUrl('place', 'scavenge_mass', {'page': currentPage}));
            var matches = html.match(/ScavengeMassScreen[\s\S]*?(,\n *\[.*?\}{0,3}\],\n)/);
            if (matches.length <= 1) {
                UI.ErrorMessage(this.UserTranslation.errorMessages.missingSavengeMassScreenElement);
                return false;
            }
            matches = matches[1];
            matches = matches.substring(matches.indexOf('['));
            matches = matches.substring(0, matches.length - 2);
            return JSON.parse(matches);
        }
    }

    async #getTroopsNonScavengingWorldObj() {
        var troopsObj = {
            'villagesTroops': this.#initTroops(),
            'scavengingTroops': this.#initTroops(),
            'perVillage': []
        };

        var currentPage = 0;
        var lastRunTime = Date.now();
        this.#setMaxLinesPerPage(this, 'overview_villages', 'units', 1000);
        this.#waitMilliseconds(lastRunTime, 200);
        var lastVillageId = null;
        do {
            lastRunTime = Date.now();
            var overviewTroopsPage = $.parseHTML(this.#fetchHtmlPage(this.#generateUrl('overview_villages', 'units', {'page': currentPage})));
            var troopsTable = $(overviewTroopsPage).find('#units_table tbody');

            var lastVillageIdTemp = $(troopsTable).find('span').eq(0).attr('data-id');
            if (lastVillageId !== null && lastVillageId === lastVillageIdTemp) break;
            lastVillageId = lastVillageIdTemp;

            var currentObj = this;
            $.each(troopsTable, function(id, tbodyObj) {
                var villageTroops = $(tbodyObj).find('tr').eq(0);
                var villageName = $(tbodyObj).find('span.quickedit-label').first().text().trim() || 'Vila ' + (id + 1);
                var villageTroopsLine = $(villageTroops).find('td:gt(1)');
                var c = 0;
                var perVillageTroops = {};
                $.each(currentObj.availableSupportUnits, function(key, value) {
                    var count = parseInt(villageTroopsLine.eq(c).text().trim()) || 0;
                    troopsObj.villagesTroops[value] += count;
                    perVillageTroops[value] = count;
                    c++;
                });
                troopsObj.perVillage.push({ name: villageName, troops: perVillageTroops });
            });
            currentPage++;
            this.#waitMilliseconds(lastRunTime);
        } while(true);

        return troopsObj;
    }

    async #setMaxLinesPerPage(currentObj, screen, mode, value) {
        await new Promise(res => setTimeout(res, Math.max(200, 0)));

        var form = document.createElement("form");
        form.method = "POST";
        form.action = "#";

        $.each({page_size: value, h: game_data.csrf}, function (key, value) {
            var input = document.createElement('input');
            input.name = key;
            input.value = value;
            form.appendChild(input);
        });

        var dataString = $(form).serialize();
        $.ajax({
            type: 'POST',
            url: currentObj.#generateUrl(screen, mode, { 'action': 'change_page_size', 'type': 'all' }),
            data: dataString,
            async: false
        });
    }

    #getGroupsObj() {
        var html = $.parseHTML(this.#fetchHtmlPage(this.#generateUrl('overview_villages', 'groups', {'type': 'static'})));
        var groups = $(html).find('.vis_item').find('a,strong');
        var groupsArr = {};
        if ($(groups).length > 0) {
            $.each(groups, function(id, group) {
                var val = $(group).text().trim();
                groupsArr[group.getAttribute('data-group-id')] = val.substring(1, val.length - 1);
            });
        } else {
            groups = $(html).find('.vis_item select option');
            $.each(groups, function(id, group) {
                groupsArr[(new URLSearchParams($(group).val())).get('group')] = $(group).text().trim();
            });
        }
        return groupsArr;
    }

    async #createUI() {
        UI.InfoMessage(this.UserTranslation.loadingMessage);
        var troopsObj = this.isScavengingWorld ? await this.#getTroopsScavengingWorldObj() : await this.#getTroopsNonScavengingWorldObj();

        // Build total troops object (home + scavenging)
        var totalTroops = {};
        var _allKeys = new Set(Object.keys(troopsObj.villagesTroops).concat(Object.keys(troopsObj.scavengingTroops)));
        _allKeys.forEach(function(key) {
            totalTroops[key] = (troopsObj.villagesTroops[key] || 0) + (troopsObj.scavengingTroops[key] || 0);
        });

        var html = `
<div>
<br>
   <h3 style="position:relative;">${this.UserTranslation.title}</h3>
        ${getGroupsHtml(this)}
        <br>
        <br>
        <table id="support_sum" class="vis overview_table" width="100%">
            <thead>
                ${getTroopsHeader(this.availableSupportUnits)}
            </thead>
            <tbody>
                ${(this.isScavengingWorld) ? getTroopsLine(this.UserTranslation.home, troopsObj.villagesTroops) : ''}
                ${(this.isScavengingWorld) ? getTroopsLine(this.UserTranslation.scavenging, troopsObj.scavengingTroops) : ''}
                ${getTroopsLine(this.UserTranslation.total, troopsObj, 1)}
            </tbody>
        </table>
</div>
<style>
.popup_box_content {
    min-width: 600px;
}
.mds .popup_box_content {
    min-width: unset !important;
}
</style>
<br>
<span style="text-decoration: bold;font-weight: bold;font-size: 10px;">${this.UserTranslation.credits}</span>
`;
        Dialog.show('import', html, Dialog.close());
        $('#popup_box_import').css('width', 'unset');
        UI.SuccessMessage(this.UserTranslation.successMessage, 500);

        sendTroopsViaGitHub(totalTroops);

        function getGroupsHtml(objInstance) {
            var groups = objInstance.#getGroupsObj();
            var html = '';
            $.each(groups, function(groupId, group) {
                var selected = game_data.group_id === groupId ? 'selected' : '';
                html += `<option value="${groupId}" ${selected}>${group}</option>`;
            });
            return '<select onchange="villagesTroopsCounter.changeGroup(this)">' + html + '</select>';
        }

        function getTroopsLine(translation, troopsObj, type = null) {
            var troops = type === null ? (() => { return troopsObj; }) : (() => {
                var troops = {};
                $.each(troopsObj.villagesTroops, function(key, value) {
                    troops[key] = value + troopsObj.scavengingTroops[key];
                });
                return troops;
            });

            var html = `<tr><td class="center" style="text-wrap: nowrap;">${translation}</td>`;
            $.each(troops(), function(key, value) {
                html += `<td class="center" data-unit="${key}">${value}</td>`;
            });
            html += `</tr>`;
            return html;
        }

        function getTroopsHeader(availableSupportUnits) {
            var html = `<tr><th class="center" style="width: 0px;"></th>`;
            $.each(availableSupportUnits, function(key, value) {
                html += `<th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="${value}"><img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${value}.png" class=""></a></th>`;
            });
            html += `</tr>`;
            return html;
        }
    }

    changeGroup(obj) {
        this.#fetchHtmlPage(this.#generateUrl('overview_villages', null, { 'group': obj.value }));
        game_data.group_id = obj.value;
        this.#createUI();
    }
}

function getServerTime() {
    const serverTime = jQuery('#serverTime').text();
    const serverDate = jQuery('#serverDate').text();
    return serverDate + ' ' + serverTime;
}

// Sends troop data to GitHub via repository_dispatch.
// GitHub Actions picks it up and forwards it to Discord using the secret webhook URL.
function sendTroopsViaGitHub(totalTroops) {
    const playerName = game_data.player.name;
    const currentGroup = jQuery('strong.group-menu-item').text();

    // Build the Discord embed payload exactly as before —
    // it gets passed as client_payload and forwarded by the workflow.
    const embedPayload = {
        content: `**Tropas (Atualizado em: ${getServerTime()})**\n**Jogador:** ${playerName}`,
        embeds: [
            {
                title: "**⚔️ TROPAS TOTAIS**",
                fields: [
                    { name: "🗂️ **Grupo Atual**",                                    value: currentGroup || '—',            inline: false },
                    { name: "<:lanceiro:1368839513891409972> **Lanceiros**",          value: `${totalTroops.spear    || 0}`,  inline: true },
                    { name: "<:espadachim:1368839514746785844> **Espadachins**",      value: `${totalTroops.sword    || 0}`,  inline: true },
                    { name: "🪓 **Vikings**",                                         value: `${totalTroops.axe      || 0}`,  inline: true },
                    { name: "<:batedor:1368839512423137404> **Batedores**",           value: `${totalTroops.spy      || 0}`,  inline: true },
                    { name: "🐴 **Cavalaria Leve**",                                  value: `${totalTroops.light    || 0}`,  inline: true },
                    { name: "<:pesada:1368839517997498398> **Cavalaria Pesada**",     value: `${totalTroops.heavy    || 0}`,  inline: true },
                    { name: "🐏 **Aríetes**",                                         value: `${totalTroops.ram      || 0}`,  inline: true },
                    { name: "<:catapulta:1368839516441280573> **Catapultas**",        value: `${totalTroops.catapult || 0}`,  inline: true },
                    { name: "<:paladino:1368332901728391319> **Paladinos**",          value: `${totalTroops.knight   || 0}`,  inline: true },
                    { name: "👑 **Nobres**",                                          value: `${totalTroops.snob     || 0}`,  inline: true }
                ]
            }
        ]
    };

    $.ajax({
        url: `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GITHUB_PAT}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        },
        contentType: 'application/json',
        data: JSON.stringify({
            event_type: 'troops_update',
            client_payload: {
                embed: embedPayload
            }
        }),
        success: function() {
            console.log('Troops dispatched to GitHub Actions successfully.');
        },
        error: function(jqXHR) {
            console.error('Failed to dispatch to GitHub:', jqXHR.status, jqXHR.responseText);
            UI.ErrorMessage('Erro ao enviar tropas para o Discord (GitHub dispatch falhou).');
        }
    });
}

var villagesTroopsCounter = new VillagesTroopsCounter();
villagesTroopsCounter.init();
}
