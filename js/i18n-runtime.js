/* 天际航线 SkyRoute — 运行时文本词典 (提示 / 检查单 / 场景 / 座舱 / 摇杆 / 致谢 / 帮助长段落)
   由 i18n.js 合并; 拼接出的提示按中文片段替换。每行: 中文|English|日本語|한국어|Français|Deutsch|Español; English 为 @ 表示沿用 i18n.js 中的英文 */
(function (global) {
  var FS = global.FS = global.FS || {};
  FS.I18N_RAW2 = String.raw`
发动机 1|Engine 1|エンジン 1|엔진 1|Moteur 1|Triebwerk 1|Motor 1
发动机 2|Engine 2|エンジン 2|엔진 2|Moteur 2|Triebwerk 2|Motor 2
发动机 3|Engine 3|エンジン 3|엔진 3|Moteur 3|Triebwerk 3|Motor 3
发动机 4|Engine 4|エンジン 4|엔진 4|Moteur 4|Triebwerk 4|Motor 4
发动机启动|Engine start|エンジン始動|엔진 시동|Démarrage moteur|Triebwerksstart|Arranque de motor
全部|all|全部|전체|tous|alle|todos
失速|Stall|失速|실속|Décrochage|Strömungsabriss|Pérdida
严重超速|Severe overspeed|重大な速度超過|심각한 과속|Survitesse sévère|Starke Überschreitung|Sobrevelocidad grave
无交流电|No AC power|AC電源なし|AC 전원 없음|Pas d'alimentation AC|Kein Wechselstrom|Sin corriente AC
IR 未完成对准|IR not aligned|IR 未アライン|IR 정렬 안 됨|IR non alignés|IR nicht ausgerichtet|IR sin alinear
人工断开|Manual disconnect|手動解除|수동 해제|Déconnexion manuelle|Manuell getrennt|Desconexión manual
IR 失效|IR failure|IR 故障|IR 고장|Panne IR|IR-Ausfall|Fallo IR
交流电失效|AC power failure|AC電源故障|AC 전원 고장|Panne AC|Wechselstromausfall|Fallo de AC
人工超控 (持续推杆)|Manual override (sustained stick input)|手動オーバーライド（操縦桿入力継続）|수동 오버라이드 (지속 조작)|Forçage manuel (action prolongée)|Manuelle Übersteuerung (anhaltend)|Anulación manual (mando sostenido)
失速保护|Stall protection|失速保護|실속 보호|Protection décrochage|Abrissschutz|Protección de pérdida
严重超速保护|Overspeed protection|速度超過保護|과속 보호|Protection survitesse|Überdrehzahlschutz|Protección de sobrevelocidad
驾驶舱 (机长)|Cockpit (Captain)|コックピット（機長）|조종석 (기장)|Cockpit (Commandant)|Cockpit (Kapitän)|Cabina (Comandante)
驾驶舱 (副驾)|Cockpit (First Officer)|コックピット（副操縦士）|조종석 (부기장)|Cockpit (Copilote)|Cockpit (Copilot)|Cabina (Copiloto)
客舱舷窗|Cabin window|客室の窓|객실 창문|Hublot cabine|Kabinenfenster|Ventanilla de cabina
机翼视角|Wing view|翼視点|날개 시점|Vue aile|Flügelansicht|Vista del ala
追踪视角|Chase view|追跡視点|추적 시점|Vue poursuite|Verfolgeransicht|Vista de persecución
塔台|Tower|タワー|관제탑|Tour|Tower|Torre
环绕|Orbit|周回|궤도|Orbite|Orbit|Órbita
自由飞行|Free flight|フリーフライト|자유 비행|Vol libre|Freier Flug|Vuelo libre
飞掠|Flyby|フライバイ|플라이바이|Passage|Vorbeiflug|Pasada
机尾|Tail|尾翼|꼬리|Queue|Heck|Cola
起落架手柄 (点击收 / 放)|Gear lever (click to raise / lower)|ギアレバー（クリックで上げ／下げ）|기어 레버 (클릭하여 올림 / 내림)|Levier de train (clic : rentrer / sortir)|Fahrwerkshebel (Klick: ein / aus)|Palanca del tren (clic: subir / bajar)
襟翼手柄 (左键放 / 右键收 / 滚轮 / 拖动)|Flap lever (left = extend / right = retract / wheel / drag)|フラップレバー（左＝下げ／右＝上げ／ホイール／ドラッグ）|플랩 레버 (왼쪽 = 내림 / 오른쪽 = 올림 / 휠 / 드래그)|Levier de volets (gauche = sortir / droite = rentrer / molette / glisser)|Klappenhebel (links = aus / rechts = ein / Rad / Ziehen)|Palanca de flaps (izq. = bajar / der. = subir / rueda / arrastrar)
减速板手柄 (左键放出 / 收回, 右键地面扰流板预位, 滚轮 / 拖动)|Speed brake lever (left = extend / retract, right = arm ground spoilers, wheel / drag)|スピードブレーキレバー（左＝展開／格納、右＝グラウンドスポイラーアーム、ホイール／ドラッグ）|스피드 브레이크 레버 (왼쪽 = 전개 / 수납, 오른쪽 = 지상 스포일러 암, 휠 / 드래그)|Levier d'aérofreins (gauche = sortir / rentrer, droite = armer spoilers sol, molette / glisser)|Bremsklappenhebel (links = aus / ein, rechts = Bodenspoiler scharf, Rad / Ziehen)|Palanca de aerofrenos (izq. = extender / retraer, der. = armar spoilers, rueda / arrastrar)
气象雷达 WX (中央操纵台后部雷达控制板)|Weather radar WX (radar panel at rear of pedestal)|気象レーダー WX（ペデスタル後部）|기상 레이더 WX (페데스탈 후방 패널)|Radar météo WX (panneau arrière du pylône)|Wetterradar WX (hinten am Pedestal)|Radar meteorológico WX (panel trasero del pedestal)
气象雷达 WX (中央操纵台雷达控制板)|Weather radar WX (pedestal radar panel)|気象レーダー WX（ペデスタルのパネル）|기상 레이더 WX (페데스탈 패널)|Radar météo WX (panneau du pylône)|Wetterradar WX (Pedestal-Panel)|Radar meteorológico WX (panel del pedestal)
侧杆 AP 断开按钮 (红色)|Sidestick AP disconnect button (red)|サイドスティック AP 解除ボタン（赤）|사이드스틱 AP 해제 버튼 (빨강)|Bouton de déconnexion PA du mini-manche (rouge)|Sidestick-AP-Trennknopf (rot)|Botón de desconexión AP del sidestick (rojo)
驾驶盘 AP 断开按钮 (红色)|Yoke AP disconnect button (red)|操縦輪 AP 解除ボタン（赤）|조종휠 AP 해제 버튼 (빨강)|Bouton de déconnexion PA du manche (rouge)|Steuerhorn-AP-Trennknopf (rot)|Botón de desconexión AP del volante (rojo)
A/THR 接通中: 推力由自动推力控制 (按 A/THR 断开后手动)|A/THR active: thrust is controlled by autothrust (disconnect A/THR for manual)|A/THR 作動中：推力はオートスラスト制御（A/THR 解除で手動）|A/THR 작동 중: 추력은 오토스러스트가 제어 (A/THR 해제 후 수동)|A/THR actif : poussée gérée automatiquement (déconnecter A/THR pour le manuel)|A/THR aktiv: Schub automatisch (A/THR trennen für manuell)|A/THR activo: empuje automático (desconecte A/THR para manual)
推力手柄 (按住上下拖动 = 推 / 收油门, 滚轮微调)|Thrust levers (drag up / down = more / less thrust, wheel to fine-tune)|スラストレバー（上下ドラッグで増減、ホイールで微調整）|스러스트 레버 (위아래 드래그 = 증가 / 감소, 휠 미세 조정)|Manettes (glisser haut / bas = plus / moins, molette = réglage fin)|Schubhebel (hoch / runter ziehen, Rad = fein)|Palancas de empuje (arrastrar arriba / abajo, rueda = ajuste fino)
ADIRU 电门 (点击 开 / 关)|ADIRU switch (click on / off)|ADIRU スイッチ（クリックでオン／オフ）|ADIRU 스위치 (클릭 켜기 / 끄기)|Interrupteur ADIRU (clic on / off)|ADIRU-Schalter (Klick ein / aus)|Interruptor ADIRU (clic on / off)
BATTERY 电门 (点击 开 / 关)|BATTERY switch (click on / off)|BATTERY スイッチ（クリックでオン／オフ）|BATTERY 스위치 (클릭 켜기 / 끄기)|Interrupteur BATTERY (clic on / off)|BATTERY-Schalter (Klick ein / aus)|Interruptor BATTERY (clic on / off)
APU 电门 (OFF / ON / START)|APU switch (OFF / ON / START)|APU スイッチ (OFF / ON / START)|APU 스위치 (OFF / ON / START)|Sélecteur APU (OFF / ON / START)|APU-Schalter (OFF / ON / START)|Interruptor APU (OFF / ON / START)
APU START (转到 START, 松手回 ON)|APU START (turn to START, springs back to ON)|APU START（START へ回すと ON に戻る）|APU START (START로 돌리면 ON으로 복귀)|APU START (tourner sur START, revient sur ON)|APU START (auf START, federt zu ON)|APU START (girar a START, vuelve a ON)
(点击 开 / 关)|(click on / off)|（クリックでオン／オフ）|(클릭 켜기 / 끄기)|(clic on / off)|(Klick ein / aus)|(clic on / off)
(点击开 / 关)|(click on / off)|（クリックでオン／オフ）|(클릭 켜기 / 끄기)|(clic on / off)|(Klick ein / aus)|(clic on / off)
频闪灯|Strobe lights|ストロボライト|스트로브 등|Feux à éclats|Blitzlichter|Luces estroboscópicas
防撞信标灯 (BEACON)|Beacon light (BEACON)|ビーコンライト (BEACON)|비컨 등 (BEACON)|Feu anticollision (BEACON)|Beacon (BEACON)|Luz anticolisión (BEACON)
防撞信标灯|Beacon light|ビーコンライト|비컨 등|Feu anticollision|Beacon|Luz anticolisión
机翼照明灯|Wing lights|翼照明|날개 조명|Feux d'aile|Flügelbeleuchtung|Luces de ala
航行灯|Navigation lights|航法灯|항법등|Feux de navigation|Positionslichter|Luces de navegación
标志灯|Logo lights|ロゴライト|로고 등|Feux de logo|Logolicht|Luces de logotipo
着陆灯|Landing lights|着陸灯|착륙등|Phares d'atterrissage|Landelichter|Luces de aterrizaje
跑道脱离灯|Runway turnoff lights|ターンオフライト|활주로 이탈등|Feux de dégagement|Abrollscheinwerfer|Luces de salida de pista
滑行灯 / 前轮灯|Taxi / nose light|タキシー／ノーズライト|유도등 / 노즈 등|Feu de roulage / avant|Rollscheinwerfer / Bug|Luz de rodaje / morro
客舱灯|Cabin lights|客室照明|객실 조명|Éclairage cabine|Kabinenlicht|Luces de cabina
APU 主电门 MASTER SW (点击 开 / 关)|APU MASTER SW (click on / off)|APU MASTER SW（クリックでオン／オフ）|APU MASTER SW (클릭 켜기 / 끄기)|APU MASTER SW (clic on / off)|APU MASTER SW (Klick ein / aus)|APU MASTER SW (clic on / off)
APU MASTER ON — 再按 START|APU MASTER ON — now press START|APU MASTER ON — 次に START|APU MASTER ON — 이제 START|APU MASTER ON — appuyez sur START|APU MASTER ON — jetzt START|APU MASTER ON — pulse START
APU START (需 MASTER SW ON 与电瓶, 约 30 秒后 AVAIL)|APU START (needs MASTER SW ON and battery; AVAIL after about 30 s)|APU START（MASTER SW ON とバッテリーが必要、約30秒で AVAIL）|APU START (MASTER SW ON과 배터리 필요, 약 30초 후 AVAIL)|APU START (MASTER SW ON et batterie requis ; AVAIL après ~30 s)|APU START (MASTER SW ON und Batterie nötig; AVAIL nach ~30 s)|APU START (requiere MASTER SW ON y batería; AVAIL tras ~30 s)
安全带灯 (点击 开 / 关)|Seat belt signs (click on / off)|シートベルトサイン（クリックでオン／オフ）|안전벨트 표시등 (클릭 켜기 / 끄기)|Consignes ceintures (clic on / off)|Anschnallzeichen (Klick ein / aus)|Señal de cinturones (clic on / off)
安全带灯|Seat belt signs|シートベルトサイン|안전벨트 표시등|Consignes ceintures|Anschnallzeichen|Señal de cinturones
发动机起动电门|Engine start switch|エンジン始動スイッチ|엔진 시동 스위치|Sélecteur de démarrage moteur|Triebwerksstartschalter|Interruptor de arranque de motor
(GRD = 地面起动, 起动完成后自动回 OFF)|(GRD = ground start; returns to OFF after start)|（GRD＝地上始動、始動後 OFF に戻る）|(GRD = 지상 시동, 시동 후 OFF 복귀)|(GRD = démarrage sol ; revient sur OFF)|(GRD = Bodenstart; danach automatisch OFF)|(GRD = arranque en tierra; vuelve a OFF)
主电瓶|Main battery|メインバッテリー|주 배터리|Batterie principale|Hauptbatterie|Batería principal
电瓶 1|Battery 1|バッテリー 1|배터리 1|Batterie 1|Batterie 1|Batería 1
电瓶 2|Battery 2|バッテリー 2|배터리 2|Batterie 2|Batterie 2|Batería 2
备用电源|Standby power|スタンバイ電源|대기 전원|Alimentation de secours|Standby-Strom|Energía de reserva
外部电源 (地面静止时 AVAIL, 点击接通 / 断开)|External power (AVAIL when stopped on ground; click to connect / disconnect)|外部電源（地上停止時 AVAIL、クリックで接続／切断）|외부 전원 (지상 정지 시 AVAIL, 클릭 연결 / 해제)|Groupe de parc (AVAIL à l'arrêt au sol ; clic pour brancher / débrancher)|Außenbordstrom (AVAIL im Stand; Klick verbinden / trennen)|Energía externa (AVAIL detenido en tierra; clic conectar / desconectar)
外部电源不可用 (仅地面静止时)|External power unavailable (only when stopped on ground)|外部電源使用不可（地上停止時のみ）|외부 전원 사용 불가 (지상 정지 시만)|Groupe de parc indisponible (à l'arrêt au sol seulement)|Außenbordstrom nicht verfügbar (nur im Stand)|Energía externa no disponible (solo detenido en tierra)
空调组件 1|Pack 1|パック 1|팩 1|Pack 1|Pack 1|Pack 1
空调组件 2|Pack 2|パック 2|팩 2|Pack 2|Pack 2|Pack 2
发动机 1 引气|Engine 1 bleed|エンジン 1 ブリード|엔진 1 블리드|Prélèvement moteur 1|Zapfluft Triebwerk 1|Sangrado motor 1
发动机 2 引气|Engine 2 bleed|エンジン 2 ブリード|엔진 2 블리드|Prélèvement moteur 2|Zapfluft Triebwerk 2|Sangrado motor 2
APU 引气 (发动机起动需要)|APU bleed (needed for engine start)|APU ブリード（エンジン始動に必要）|APU 블리드 (엔진 시동에 필요)|Prélèvement APU (requis pour démarrer)|APU-Zapfluft (für Triebwerksstart)|Sangrado APU (necesario para arrancar)
隔离活门 (CLOSE / AUTO / OPEN)|Isolation valve (CLOSE / AUTO / OPEN)|アイソレーションバルブ (CLOSE / AUTO / OPEN)|격리 밸브 (CLOSE / AUTO / OPEN)|Vanne d'isolement (CLOSE / AUTO / OPEN)|Trennventil (CLOSE / AUTO / OPEN)|Válvula de aislamiento (CLOSE / AUTO / OPEN)
交输引气 (SHUT / AUTO / OPEN)|Crossbleed (SHUT / AUTO / OPEN)|クロスブリード (SHUT / AUTO / OPEN)|크로스블리드 (SHUT / AUTO / OPEN)|Intercommunication (SHUT / AUTO / OPEN)|Crossbleed (SHUT / AUTO / OPEN)|Sangrado cruzado (SHUT / AUTO / OPEN)
燃油泵|Fuel pump|燃料ポンプ|연료 펌프|Pompe carburant|Kraftstoffpumpe|Bomba de combustible
液压 发动机 1 泵|Hydraulic engine 1 pump|油圧 エンジン 1 ポンプ|유압 엔진 1 펌프|Pompe hydraulique moteur 1|Hydraulik Triebwerkspumpe 1|Bomba hidráulica motor 1
液压 发动机 2 泵|Hydraulic engine 2 pump|油圧 エンジン 2 ポンプ|유압 엔진 2 펌프|Pompe hydraulique moteur 2|Hydraulik Triebwerkspumpe 2|Bomba hidráulica motor 2
液压 电动泵 1|Hydraulic electric pump 1|油圧 電動ポンプ 1|유압 전동 펌프 1|Pompe hydraulique électrique 1|Hydraulik Elektropumpe 1|Bomba hidráulica eléctrica 1
液压 电动泵 2|Hydraulic electric pump 2|油圧 電動ポンプ 2|유압 전동 펌프 2|Pompe hydraulique électrique 2|Hydraulik Elektropumpe 2|Bomba hidráulica eléctrica 2
蓝液压 电动泵|Blue hydraulic electric pump|ブルー油圧 電動ポンプ|블루 유압 전동 펌프|Pompe électrique hydraulique bleue|Blaue Hydraulik Elektropumpe|Bomba eléctrica hidráulica azul
动力转换组件 PTU|Power transfer unit PTU|動力伝達装置 PTU|동력 전달 장치 PTU|Groupe de transfert PTU|Power Transfer Unit PTU|Unidad de transferencia PTU
惯导 IR|Inertial reference IR|慣性基準 IR|관성 기준 IR|Référence inertielle IR|Trägheitsreferenz IR|Referencia inercial IR
方式选择 (NAV = 对准后提供导航, 约 75 秒)|mode selector (NAV = navigation after alignment, about 75 s)|モード選択（NAV＝アライン後に航法、約75秒）|모드 선택 (NAV = 정렬 후 항법, 약 75초)|sélecteur de mode (NAV = navigation après alignement, ~75 s)|Moduswahl (NAV = Navigation nach Ausrichtung, ~75 s)|selector de modo (NAV = navegación tras alinear, ~75 s)
探头 / 风挡加温|Probe / window heat|プローブ／ウインドウヒート|프로브 / 창 가열|Réchauffage sondes / pare-brise|Sonden- / Scheibenheizung|Calefacción de sondas / parabrisas
机翼防冰|Wing anti-ice|翼防氷|날개 방빙|Antigivrage voilure|Flügelenteisung|Antihielo de ala
发动机 1 防冰|Engine 1 anti-ice|エンジン 1 防氷|엔진 1 방빙|Antigivrage moteur 1|Triebwerksenteisung 1|Antihielo motor 1
发动机 2 防冰|Engine 2 anti-ice|エンジン 2 防氷|엔진 2 방빙|Antigivrage moteur 2|Triebwerksenteisung 2|Antihielo motor 2
燃油控制电门|Fuel control switch|燃料コントロールスイッチ|연료 제어 스위치|Interrupteur de carburant|Kraftstoffschalter|Interruptor de control de combustible
发动机主电门|Engine master switch|エンジンマスタースイッチ|엔진 마스터 스위치|Interrupteur maître moteur|Triebwerkshauptschalter|Interruptor maestro de motor
(RUN / CUTOFF; 冷舱: 先把 ENG START 旋到 GRD)|(RUN / CUTOFF; cold & dark: first turn ENG START to GRD)|（RUN / CUTOFF、コールドスタート時は先に ENG START を GRD へ）|(RUN / CUTOFF; 콜드 스타트: 먼저 ENG START를 GRD로)|(RUN / CUTOFF ; à froid : d'abord ENG START sur GRD)|(RUN / CUTOFF; Kaltstart: zuerst ENG START auf GRD)|(RUN / CUTOFF; en frío: primero ENG START a GRD)
(ON / OFF; 冷舱: 先把 ENG MODE 旋到 IGN/START)|(ON / OFF; cold & dark: first turn ENG MODE to IGN/START)|（ON / OFF、コールドスタート時は先に ENG MODE を IGN/START へ）|(ON / OFF; 콜드 스타트: 먼저 ENG MODE를 IGN/START로)|(ON / OFF ; à froid : d'abord ENG MODE sur IGN/START)|(ON / OFF; Kaltstart: zuerst ENG MODE auf IGN/START)|(ON / OFF; en frío: primero ENG MODE a IGN/START)
发动机方式选择 ENG MODE (IGN/START = 起动, 起动后回 NORM)|Engine mode selector ENG MODE (IGN/START = start, back to NORM afterwards)|エンジンモード ENG MODE（IGN/START＝始動、後で NORM へ）|엔진 모드 ENG MODE (IGN/START = 시동, 이후 NORM)|Sélecteur ENG MODE (IGN/START = démarrage, puis NORM)|Triebwerksmodus ENG MODE (IGN/START = Start, danach NORM)|Selector ENG MODE (IGN/START = arranque, luego NORM)
停留刹车 (点击 / 滚轮 开关)|Parking brake (click / wheel to toggle)|パーキングブレーキ（クリック／ホイールで切替）|주차 브레이크 (클릭 / 휠로 전환)|Frein de parking (clic / molette)|Parkbremse (Klick / Rad)|Freno de estacionamiento (clic / rueda)
应答机 (STBY / AUTO / ON)|Transponder (STBY / AUTO / ON)|トランスポンダー (STBY / AUTO / ON)|트랜스폰더 (STBY / AUTO / ON)|Transpondeur (STBY / AUTO / ON)|Transponder (STBY / AUTO / ON)|Transpondedor (STBY / AUTO / ON)
自动刹车 (左键 / 滚轮向上 = 下一档, 右键 = 上一档)|Autobrake (left / wheel up = next setting, right = previous)|オートブレーキ（左／ホイール上＝次、右＝前）|오토브레이크 (왼쪽 / 휠 위 = 다음, 오른쪽 = 이전)|Autofreinage (gauche / molette haut = suivant, droite = précédent)|Autobremse (links / Rad hoch = nächste, rechts = vorherige)|Autofreno (izq. / rueda arriba = siguiente, der. = anterior)
放出|extended|展開|전개|sortis|ausgefahren|extendidos
收回|retracted|格納|수납|rentrés|eingefahren|retraídos
半程|half|ハーフ|절반|mi-course|halb|medio
全放出|full|フル|최대|plein|voll|completo
飞行指引 FD|Flight director FD|フライトディレクター FD|비행 지시기 FD|Directeur de vol FD|Flugregler FD|Director de vuelo FD
开|on|オン|켜짐|activé|ein|activado
关|off|オフ|꺼짐|désactivé|aus|desactivado
空客 A350-900|Airbus A350-900|エアバス A350-900|에어버스 A350-900|Airbus A350-900|Airbus A350-900|Airbus A350-900
空客 A350-1000 (碳纤维)|Airbus A350-1000 (carbon fiber)|エアバス A350-1000（カーボン）|에어버스 A350-1000 (카본)|Airbus A350-1000 (fibre de carbone)|Airbus A350-1000 (Carbon)|Airbus A350-1000 (fibra de carbono)
空客 A320neo|Airbus A320neo|エアバス A320neo|에어버스 A320neo|Airbus A320neo|Airbus A320neo|Airbus A320neo
空客 A320ceo|Airbus A320ceo|エアバス A320ceo|에어버스 A320ceo|Airbus A320ceo|Airbus A320ceo|Airbus A320ceo
空客 A321neo|Airbus A321neo|エアバス A321neo|에어버스 A321neo|Airbus A321neo|Airbus A321neo|Airbus A321neo
空客 A330-300|Airbus A330-300|エアバス A330-300|에어버스 A330-300|Airbus A330-300|Airbus A330-300|Airbus A330-300
波音 737-800|Boeing 737-800|ボーイング 737-800|보잉 737-800|Boeing 737-800|Boeing 737-800|Boeing 737-800
波音 737 MAX 8|Boeing 737 MAX 8|ボーイング 737 MAX 8|보잉 737 MAX 8|Boeing 737 MAX 8|Boeing 737 MAX 8|Boeing 737 MAX 8
波音 777-300ER|Boeing 777-300ER|ボーイング 777-300ER|보잉 777-300ER|Boeing 777-300ER|Boeing 777-300ER|Boeing 777-300ER
波音 787-9 梦想客机|Boeing 787-9 Dreamliner|ボーイング 787-9 ドリームライナー|보잉 787-9 드림라이너|Boeing 787-9 Dreamliner|Boeing 787-9 Dreamliner|Boeing 787-9 Dreamliner
中国商飞 C919|COMAC C919|COMAC C919|COMAC C919|COMAC C919|COMAC C919|COMAC C919
巴航工业 E190|Embraer E190|エンブラエル E190|엠브라에르 E190|Embraer E190|Embraer E190|Embraer E190
碳纤维|Carbon Fiber|カーボンファイバー|카본 파이버|Fibre de carbone|Carbonfaser|Fibra de carbono
经典白|Classic White|クラシックホワイト|클래식 화이트|Blanc classique|Klassisch Weiß|Blanco clásico
深海蓝|Deep Blue|ディープブルー|딥 블루|Bleu profond|Tiefblau|Azul profundo
经典红尾|Classic Red Tail|クラシックレッドテール|클래식 레드 테일|Dérive rouge classique|Klassisches Rotes Heck|Cola roja clásica
日落橙|Sunset Orange|サンセットオレンジ|선셋 오렌지|Orange couchant|Sonnenuntergangsorange|Naranja atardecer
森林绿|Forest Green|フォレストグリーン|포레스트 그린|Vert forêt|Waldgrün|Verde bosque
湖水青|Lake Teal|レイクティール|레이크 틸|Bleu lagon|Seetürkis|Verde azulado
暮光紫|Twilight Purple|トワイライトパープル|트와일라잇 퍼플|Violet crépuscule|Dämmerungsviolett|Púrpura crepúsculo
晴空蓝|Sky Blue|スカイブルー|스카이 블루|Bleu ciel|Himmelblau|Azul cielo
石墨黑|Graphite|グラファイト|그래파이트|Graphite|Graphit|Grafito
沙丘金|Dune Gold|デューンゴールド|듄 골드|Or des dunes|Dünengold|Oro duna
极光绿蓝|Aurora Teal|オーロラティール|오로라 틸|Aurore turquoise|Polarlicht-Türkis|Aurora turquesa
通用灰|Neutral Gray|ニュートラルグレー|뉴트럴 그레이|Gris neutre|Neutralgrau|Gris neutro
晴空万里|Clear skies|快晴|맑음|Ciel dégagé|Wolkenlos|Despejado
少云|Few clouds|少ない雲|구름 조금|Quelques nuages|Gering bewölkt|Pocas nubes
疏云|Scattered|散在雲|구름 산재|Nuages épars|Aufgelockert|Nubes dispersas
多云|Broken|曇りがち|구름 많음|Nuageux|Stark bewölkt|Nuboso
阴天|Overcast|曇天|흐림|Couvert|Bedeckt|Cubierto
降雨|Rain|雨|비|Pluie|Regen|Lluvia
雷暴|Thunderstorm|雷雨|뇌우|Orage|Gewitter|Tormenta
降雪|Snow|雪|눈|Neige|Schnee|Nieve
浓雾|Fog|濃霧|짙은 안개|Brouillard|Nebel|Niebla
霾/轻雾|Haze / mist|もや|연무 / 박무|Brume|Dunst|Calima / neblina
大风|Windy|強風|강풍|Venteux|Windig|Ventoso
晴夜|Clear night|晴れた夜|맑은 밤|Nuit claire|Klare Nacht|Noche despejada
发动机起动失败: 无电源|Engine start failed: no power|エンジン始動失敗：電源なし|엔진 시동 실패: 전원 없음|Échec démarrage moteur : pas d'alimentation|Triebwerksstart fehlgeschlagen: kein Strom|Fallo de arranque: sin energía
APU 起动失败: 电池未接通|APU start failed: battery off|APU 始動失敗：バッテリーオフ|APU 시동 실패: 배터리 꺼짐|Échec démarrage APU : batterie coupée|APU-Start fehlgeschlagen: Batterie aus|Fallo de arranque APU: batería apagada
电池主开关|Battery master|バッテリーマスター|배터리 마스터|Batterie principale|Batteriehauptschalter|Batería principal
该跑道没有 ILS|This runway has no ILS|この滑走路には ILS がありません|이 활주로에는 ILS가 없습니다|Cette piste n'a pas d'ILS|Diese Piste hat kein ILS|Esta pista no tiene ILS
找不到跑道|Runway not found|滑走路が見つかりません|활주로를 찾을 수 없음|Piste introuvable|Piste nicht gefunden|Pista no encontrada
找不到停机位|Stand not found|スポットが見つかりません|주기장을 찾을 수 없음|Poste introuvable|Parkposition nicht gefunden|Puesto no encontrado
m 翼展|m wingspan|m 翼幅|m 날개폭|m d'envergure|m Spannweite|m de envergadura
座|seats|席|석|sièges|Sitze|asientos
宽体客机|Wide-body|ワイドボディ機|광동체기|Gros-porteur|Großraumflugzeug|Fuselaje ancho
窄体客机|Narrow-body|ナローボディ機|협동체기|Monocouloir|Schmalrumpf|Fuselaje estrecho
支线客机|Regional jet|リージョナルジェット|리저널 제트|Avion régional|Regionaljet|Avión regional
程序化模型|Procedural models|プロシージャルモデル|절차적 모델|Modèles procéduraux|Prozedurale Modelle|Modelos procedurales
真实模型 · 近似|Real model · approximate|実機モデル · 近似|실제 모델 · 근사|Modèle réel · approché|Echtes Modell · angenähert|Modelo real · aproximado
真实模型 · 派生|Real model · derived|実機モデル · 派生|실제 모델 · 파생|Modèle réel · dérivé|Echtes Modell · abgeleitet|Modelo real · derivado
真实模型|Real model|実機モデル|실제 모델|Modèle réel|Echtes Modell|Modelo real
亚洲|Asia|アジア|아시아|Asie|Asien|Asia
欧洲|Europe|ヨーロッパ|유럽|Europe|Europa|Europa
北美洲|North America|北米|북미|Amérique du Nord|Nordamerika|Norteamérica
大洋洲|Oceania|オセアニア|오세아니아|Océanie|Ozeanien|Oceanía
南美洲|South America|南米|남미|Amérique du Sud|Südamerika|Sudamérica
非洲|Africa|アフリカ|아프리카|Afrique|Afrika|África
中东|Middle East|中東|중동|Moyen-Orient|Naher Osten|Oriente Medio
入门|Beginner|初級|입문|Débutant|Einsteiger|Principiante
进阶|Intermediate|中級|중급|Intermédiaire|Fortgeschritten|Intermedio
困难|Hard|上級|어려움|Difficile|Schwer|Difícil
提示:|Tip:|ヒント:|팁:|Astuce :|Tipp:|Consejo:
大圆距离|great-circle distance|大圏距離|대권 거리|distance orthodromique|Großkreisentfernung|distancia ortodrómica
速度选择|Speed select|速度選択|속도 선택|Vitesse sélectée|Geschwindigkeitswahl|Velocidad seleccionada
LNAV 已接通|LNAV engaged|LNAV 作動|LNAV 연결됨|LNAV engagé|LNAV aktiv|LNAV activado
航向选择|Heading select|方位選択|방위 선택|Cap sélecté|Kurswahl|Rumbo seleccionado
爬升至最高高度|Climb to max altitude|最高高度へ上昇|최대 고도로 상승|Montée à l'altitude max|Steigen auf Maximalhöhe|Ascender a altitud máxima
目标高度|Target altitude|目標高度|목표 고도|Altitude cible|Zielhöhe|Altitud objetivo
高度保持|Altitude hold|高度保持|고도 유지|Maintien d'altitude|Höhe halten|Mantener altitud
无法接通自动驾驶 (失速 / 严重超速 / IR 未对准 / 无电源)|Cannot engage autopilot (stall / overspeed / IR not aligned / no power)|AP を作動できません（失速／速度超過／IR 未アライン／電源なし）|오토파일럿 연결 불가 (실속 / 과속 / IR 미정렬 / 전원 없음)|Impossible d'engager le PA (décrochage / survitesse / IR non alignés / pas d'alimentation)|Autopilot nicht aktivierbar (Abriss / Überschreitung / IR nicht ausgerichtet / kein Strom)|No se puede activar el AP (pérdida / sobrevelocidad / IR sin alinear / sin energía)
无法接通自动驾驶 (失速 / 严重超速)|Cannot engage autopilot (stall / overspeed)|AP を作動できません（失速／速度超過）|오토파일럿 연결 불가 (실속 / 과속)|Impossible d'engager le PA (décrochage / survitesse)|Autopilot nicht aktivierbar (Abriss / Überschreitung)|No se puede activar el AP (pérdida / sobrevelocidad)
无法接通自动驾驶:|Cannot engage autopilot:|AP を作動できません:|오토파일럿 연결 불가:|Impossible d'engager le PA :|Autopilot nicht aktivierbar:|No se puede activar el AP:
自动驾驶断开:|Autopilot disconnected:|AP 解除:|오토파일럿 해제:|PA déconnecté :|Autopilot getrennt:|AP desconectado:
接通|engaged|作動|연결|engagé|aktiv|activado
断开|off|解除|해제|déconnecté|getrennt|desconectado
预位|armed|アーム|준비|armé|scharf|armado
解除预位|disarmed|アーム解除|준비 해제|désarmé|entschärft|desarmado
取消|cancelled|取消|취소|annulé|abgebrochen|cancelado
FLCH / 速度优先|FLCH / speed priority|FLCH／速度優先|FLCH / 속도 우선|FLCH / priorité vitesse|FLCH / Geschwindigkeitspriorität|FLCH / prioridad velocidad
AP 断开警告已消音 (再按 T 接通)|AP disconnect warning silenced (press T again to engage)|AP 解除警告を消音（もう一度 T で作動）|AP 해제 경고 음소거 (다시 T로 연결)|Alarme PA coupée (T à nouveau pour engager)|AP-Trennwarnung stumm (T erneut zum Aktivieren)|Aviso AP silenciado (T otra vez para activar)
AP 断开警告已消音|AP disconnect warning silenced|AP 解除警告を消音|AP 해제 경고 음소거|Alarme PA coupée|AP-Trennwarnung stumm|Aviso AP silenciado
恢复机翼水平|Wings level|翼水平に復帰|날개 수평 복귀|Ailes horizontales|Flügel waagerecht|Alas niveladas
复飞 TOGA|Go-around TOGA|ゴーアラウンド TOGA|복행 TOGA|Remise des gaz TOGA|Durchstarten TOGA|Motor y al aire TOGA
空速过高, 起落架不能收放|Airspeed too high — gear cannot move|速度超過、ギア操作不可|속도 초과, 기어 작동 불가|Vitesse trop élevée, train bloqué|Fahrt zu hoch, Fahrwerk gesperrt|Velocidad excesiva, tren bloqueado
空速过高, 起落架禁止操作|Airspeed too high — gear locked|速度超過、ギア操作禁止|속도 초과, 기어 작동 금지|Vitesse trop élevée, train bloqué|Fahrt zu hoch, Fahrwerk gesperrt|Velocidad excesiva, tren bloqueado
起落架 收上|Gear up|ギア上げ|기어 올림|Train rentré|Fahrwerk eingefahren|Tren arriba
起落架 放下|Gear down|ギア下げ|기어 내림|Train sorti|Fahrwerk ausgefahren|Tren abajo
地面扰流板|Ground spoilers|グラウンドスポイラー|지상 스포일러|Spoilers sol|Bodenspoiler|Spoilers de tierra
推出中… 再按一次停止|Pushing back… press again to stop|プッシュバック中… もう一度押すと停止|푸시백 중… 다시 누르면 정지|Repoussage… rappuyer pour arrêter|Pushback… erneut drücken zum Stoppen|Pushback… pulse de nuevo para parar
推出中… 再按 Shift+P 停止|Pushing back… press Shift+P to stop|プッシュバック中… Shift+P で停止|푸시백 중… Shift+P로 정지|Repoussage… Maj+P pour arrêter|Pushback… Umschalt+P zum Stoppen|Pushback… Mayús+P para parar
推出结束|Pushback complete|プッシュバック完了|푸시백 완료|Repoussage terminé|Pushback beendet|Pushback terminado
ON — 座舱通电|ON — cockpit powered|ON — コックピット通電|ON — 조종석 전원 공급|ON — cockpit alimenté|ON — Cockpit unter Strom|ON — cabina energizada
OFF — 座舱断电|OFF — cockpit unpowered|OFF — コックピット断電|OFF — 조종석 전원 차단|OFF — cockpit hors tension|OFF — Cockpit stromlos|OFF — cabina sin energía
APU 停车|APU shut down|APU 停止|APU 정지|APU arrêté|APU aus|APU apagado
APU 起动中, 约 30 秒后可用|APU starting, available in about 30 s|APU 始動中、約30秒で使用可能|APU 시동 중, 약 30초 후 사용 가능|APU en démarrage, disponible dans ~30 s|APU startet, in ~30 s verfügbar|APU arrancando, disponible en ~30 s
APU 起动中…|APU starting…|APU 始動中…|APU 시동 중…|APU en démarrage…|APU startet…|APU arrancando…
起动中|starting|始動中|시동 중|en démarrage|startet|arrancando
关车|shut down|停止|정지|arrêté|abgeschaltet|apagado
全部发动机起动中|Starting all engines|全エンジン始動中|모든 엔진 시동 중|Démarrage de tous les moteurs|Alle Triebwerke starten|Arrancando todos los motores
起动全部发动机…|Starting all engines…|全エンジン始動…|모든 엔진 시동…|Démarrage de tous les moteurs…|Alle Triebwerke starten…|Arrancando todos los motores…
滑行灯|Taxi light|タキシーライト|유도등|Feu de roulage|Rollscheinwerfer|Luz de rodaje
信标灯|Beacon|ビーコン|비컨|Feu anticollision|Beacon|Baliza
机翼灯|Wing light|翼ライト|날개 등|Feu d'aile|Flügellicht|Luz de ala
ND 模式|ND mode|ND モード|ND 모드|Mode ND|ND-Modus|Modo ND
视角:|View:|視点:|시점:|Vue :|Ansicht:|Vista:
鼠标驾驶杆: 开 (光标相对屏幕中心 = 杆量, M 键关闭)|Mouse yoke: on (cursor offset from center = stick input, M to turn off)|マウス操縦桿：オン（中央からの位置＝操縦量、M でオフ）|마우스 조종간: 켜짐 (중앙 기준 커서 = 조종량, M으로 끄기)|Manche souris : activé (décalage = commande, M pour couper)|Maussteuerung: ein (Abstand = Ausschlag, M zum Ausschalten)|Palanca con ratón: activada (desplazamiento = mando, M para desactivar)
鼠标驾驶杆: 开 (光标相对屏幕中心 = 杆量, 再按 M 关闭)|Mouse yoke: on (cursor offset from center = stick input, press M again to turn off)|マウス操縦桿：オン（中央からの位置＝操縦量、もう一度 M でオフ）|마우스 조종간: 켜짐 (중앙 기준 커서 = 조종량, 다시 M으로 끄기)|Manche souris : activé (décalage = commande, M à nouveau pour couper)|Maussteuerung: ein (Abstand = Ausschlag, erneut M zum Ausschalten)|Palanca con ratón: activada (desplazamiento = mando, M otra vez para desactivar)
鼠标驾驶杆: 关|Mouse yoke: off|マウス操縦桿：オフ|마우스 조종간: 꺼짐|Manche souris : désactivé|Maussteuerung: aus|Palanca con ratón: desactivada
小键盘+|Numpad +|テンキー +|숫자패드 +|Pavé num. +|Ziffernblock +|Teclado num. +
小键盘-|Numpad -|テンキー -|숫자패드 -|Pavé num. -|Ziffernblock -|Teclado num. -
小键盘Enter|Numpad Enter|テンキー Enter|숫자패드 Enter|Pavé num. Entrée|Ziffernblock Enter|Teclado num. Intro
小键盘|Numpad |テンキー |숫자패드 |Pavé num. |Ziffernblock |Teclado num. 
手柄已连接:|Gamepad connected:|ゲームパッド接続:|게임패드 연결됨:|Manette connectée :|Gamepad verbunden:|Mando conectado:
俯仰 (拉杆抬头)|Pitch (pull = nose up)|ピッチ（引くと機首上げ）|피치 (당기면 기수 올림)|Tangage (tirer = cabrer)|Nicken (ziehen = Nase hoch)|Cabeceo (tirar = morro arriba)
横滚|Roll|ロール|롤|Roulis|Rollen|Alabeo
方向舵 / 扭转 / 脚舵|Rudder / twist / pedals|ラダー／ツイスト／ペダル|방향타 / 비틀기 / 페달|Direction / torsion / palonniers|Seitenruder / Drehung / Pedale|Timón / giro / pedales
油门 1 (或全部)|Throttle 1 (or all)|スロットル 1（または全部）|스로틀 1 (또는 전체)|Manette 1 (ou toutes)|Schub 1 (oder alle)|Acelerador 1 (o todos)
油门 2|Throttle 2|スロットル 2|스로틀 2|Manette 2|Schub 2|Acelerador 2
左趾刹 (脚舵)|Left toe brake (pedals)|左トーブレーキ（ペダル）|왼쪽 토 브레이크 (페달)|Frein gauche (palonniers)|Linke Zehenbremse (Pedale)|Freno izquierdo (pedales)
右趾刹 (脚舵)|Right toe brake (pedals)|右トーブレーキ（ペダル）|오른쪽 토 브레이크 (페달)|Frein droit (palonniers)|Rechte Zehenbremse (Pedale)|Freno derecho (pedales)
苦力帽 POV (驾驶舱环视)|Hat switch POV (cockpit look-around)|ハットスイッチ POV（コックピット見回し）|햇 스위치 POV (조종석 둘러보기)|Chapeau chinois POV (regard cockpit)|Coolie-Hat POV (Cockpit-Umsicht)|Seta POV (mirar en cabina)
AP 断开|AP disconnect|AP 解除|AP 해제|Déconnexion PA|AP trennen|Desconexión AP
PTT 通话|PTT (push to talk)|PTT 送信|PTT 송신|PTT (alternat)|PTT (Sprechtaste)|PTT (pulsar para hablar)
刹车 (按住)|Brakes (hold)|ブレーキ（長押し）|브레이크 (누르고 있기)|Freins (maintenir)|Bremsen (halten)|Frenos (mantener)
襟翼 收|Flaps up|フラップ上げ|플랩 올림|Volets rentrer|Klappen ein|Flaps arriba
襟翼 放|Flaps down|フラップ下げ|플랩 내림|Volets sortir|Klappen aus|Flaps abajo
切换视角|Change view|視点切替|시점 전환|Changer de vue|Ansicht wechseln|Cambiar vista
反推|Reversers|リバーサー|역추진|Inverseurs|Umkehrschub|Reversas
侧杆 / 摇杆|Sidestick / joystick|サイドスティック／ジョイスティック|사이드스틱 / 조이스틱|Mini-manche / joystick|Sidestick / Joystick|Sidestick / joystick
HOTAS (杆 + 油门)|HOTAS (stick + throttle)|HOTAS（スティック＋スロットル）|HOTAS (스틱 + 스로틀)|HOTAS (manche + manettes)|HOTAS (Stick + Schub)|HOTAS (palanca + acelerador)
摇杆 (通用)|Joystick (generic)|ジョイスティック（汎用）|조이스틱 (일반)|Joystick (générique)|Joystick (generisch)|Joystick (genérico)
油门台|Throttle quadrant|スロットルクアドラント|스로틀 쿼드런트|Bloc manettes|Schubhebeleinheit|Cuadrante de aceleradores
未检测到摇杆。请连接设备后|No joystick detected. Connect a device, then|ジョイスティックが検出されません。接続後|조이스틱이 감지되지 않았습니다. 장치를 연결한 후|Aucun joystick détecté. Branchez un appareil, puis|Kein Joystick erkannt. Gerät anschließen, dann|No se detecta joystick. Conecte un dispositivo y
按一下摇杆上的任意按钮|press any button on the joystick|ジョイスティックの任意のボタンを押してください|조이스틱의 아무 버튼이나 누르세요|appuyez sur un bouton du joystick|eine beliebige Joystick-Taste drücken|pulse cualquier botón del joystick
(Chrome/Edge 的要求)。|(required by Chrome/Edge).|（Chrome/Edge の仕様）。|(Chrome/Edge 요구 사항).|(exigé par Chrome/Edge).|(von Chrome/Edge verlangt).|(requisito de Chrome/Edge).
标准游戏手柄 (Xbox/PS) 无需设置: 左摇杆 = 驾驶杆, LB/RB = 方向舵, LT/RT = 油门, A = 起落架, X = 刹车, Y = 视角, 十字键上/下 = 襟翼, Start = 暂停, Back = AP 断开。|Standard gamepads (Xbox/PS) need no setup: left stick = yoke, LB/RB = rudder, LT/RT = throttle, A = gear, X = brakes, Y = view, D-pad up/down = flaps, Start = pause, Back = AP disconnect.|標準ゲームパッド（Xbox/PS）は設定不要：左スティック＝操縦桿、LB/RB＝ラダー、LT/RT＝スロットル、A＝ギア、X＝ブレーキ、Y＝視点、十字キー上下＝フラップ、Start＝一時停止、Back＝AP 解除。|표준 게임패드(Xbox/PS)는 설정 불필요: 왼쪽 스틱 = 조종간, LB/RB = 방향타, LT/RT = 스로틀, A = 기어, X = 브레이크, Y = 시점, 십자키 위/아래 = 플랩, Start = 일시정지, Back = AP 해제.|Les manettes standard (Xbox/PS) ne demandent aucun réglage : stick gauche = manche, LB/RB = direction, LT/RT = manettes, A = train, X = freins, Y = vue, croix haut/bas = volets, Start = pause, Back = déconnexion PA.|Standard-Gamepads (Xbox/PS) brauchen keine Einrichtung: linker Stick = Steuer, LB/RB = Seitenruder, LT/RT = Schub, A = Fahrwerk, X = Bremsen, Y = Ansicht, Steuerkreuz hoch/runter = Klappen, Start = Pause, Back = AP trennen.|Los mandos estándar (Xbox/PS) no requieren ajustes: stick izquierdo = palanca, LB/RB = timón, LT/RT = aceleradores, A = tren, X = frenos, Y = vista, cruceta arriba/abajo = flaps, Start = pausa, Back = desconexión AP.
标准手柄 (自动映射)|Standard gamepad (auto-mapped)|標準ゲームパッド（自動割り当て）|표준 게임패드 (자동 매핑)|Manette standard (auto)|Standard-Gamepad (automatisch)|Mando estándar (automático)
摇杆|Joystick|ジョイスティック|조이스틱|Joystick|Joystick|Joystick
按摇杆方式映射|Map as joystick|ジョイスティックとして割り当て|조이스틱으로 매핑|Affecter comme joystick|Als Joystick belegen|Asignar como joystick
功能|Function|機能|기능|Fonction|Funktion|Función
轴|Axis|軸|축|Axe|Achse|Eje
反向|Invert|反転|반전|Inverser|Umkehren|Invertir
— 无 —|— none —|— なし —|— 없음 —|— aucun —|— keine —|— ninguno —
请移动该轴…|Move the axis…|軸を動かしてください…|축을 움직이세요…|Bougez l'axe…|Achse bewegen…|Mueva el eje…
检测|Detect|検出|감지|Détecter|Erkennen|Detectar
按钮功能|Button function|ボタン機能|버튼 기능|Fonction du bouton|Tastenfunktion|Función del botón
按钮|Button|ボタン|버튼|Bouton|Taste|Botón
请按下按钮…|Press a button…|ボタンを押してください…|버튼을 누르세요…|Appuyez sur un bouton…|Taste drücken…|Pulse un botón…
死区|Dead zone|デッドゾーン|데드존|Zone morte|Totzone|Zona muerta
灵敏度|Sensitivity|感度|감도|Sensibilité|Empfindlichkeit|Sensibilidad
曲线|Curve|カーブ|커브|Courbe|Kurve|Curva
检测到设备:|Detected devices:|検出されたデバイス:|감지된 장치:|Appareils détectés :|Erkannte Geräte:|Dispositivos detectados:
键|buttons|ボタン|버튼|boutons|Tasten|botones
无|none|なし|없음|aucun|keine|ninguno
初始化失败|Initialization failed|初期化に失敗しました|초기화 실패|Échec de l'initialisation|Initialisierung fehlgeschlagen|Error de inicialización
初始化失败:|Initialization failed:|初期化失敗:|초기화 실패:|Échec de l'initialisation :|Initialisierung fehlgeschlagen:|Error de inicialización:
失速警告 — 立即减小迎角|Stall warning — reduce angle of attack now|失速警告 — 直ちに迎角を減らせ|실속 경고 — 즉시 받음각을 줄이세요|Alarme décrochage — réduisez l'incidence|Abrisswarnung — Anstellwinkel verringern|Aviso de pérdida — reduzca el ángulo de ataque
抖杆 STALL — 失速保护已介入, 请推杆 / 加油门|Stick shaker STALL — stall protection active, push forward / add thrust|スティックシェーカー STALL — 失速保護作動、機首下げ／推力増加|스틱 셰이커 STALL — 실속 보호 작동, 밀고 / 추력 증가|Vibreur STALL — protection active, piquez / poussez les gaz|Stickshaker STALL — Abrissschutz aktiv, nachdrücken / Schub erhöhen|Vibrador STALL — protección activa, empuje / más potencia
超速警告|Overspeed warning|速度超過警告|과속 경고|Alarme survitesse|Überschreitungswarnung|Aviso de sobrevelocidad
燃油不足|Low fuel|燃料不足|연료 부족|Carburant bas|Treibstoff niedrig|Combustible bajo
燃油耗尽 — 发动机停车|Fuel exhausted — engines flamed out|燃料切れ — エンジン停止|연료 소진 — 엔진 정지|Carburant épuisé — moteurs éteints|Treibstoff leer — Triebwerke aus|Sin combustible — motores apagados
非常柔和|Butter-smooth|非常にソフト|매우 부드러움|Très douce|Sehr sanft|Muy suave
良好|Good|良好|양호|Bonne|Gut|Buena
偏重|Firm|やや強め|다소 강함|Ferme|Hart|Firme
重着陆|Hard landing|ハードランディング|하드 랜딩|Atterrissage dur|Harte Landung|Aterrizaje duro
重着陆!|Hard landing!|ハードランディング!|하드 랜딩!|Atterrissage dur !|Harte Landung!|¡Aterrizaje duro!
接地|Touchdown|接地|접지|Toucher|Aufsetzen|Toma
— 请检查机体|— inspect the airframe|— 機体点検を|— 기체를 점검하세요|— inspectez l'avion|— Zelle prüfen|— revise la aeronave
A/THR 保持|A/THR stays|A/THR 維持|A/THR 유지|A/THR maintenu|A/THR bleibt|A/THR sigue
— 再按 T / AP 断开钮消音|— press T / AP disconnect again to silence|— もう一度 T／AP 解除で消音|— 다시 T / AP 해제로 음소거|— T / déconnexion PA pour couper|— T / AP-Trennknopf erneut zum Stummschalten|— T / desconexión AP para silenciar
LOC 已截获|LOC captured|LOC 捕捉|LOC 포착|LOC capturé|LOC erfasst|LOC capturado
G/S 已截获|G/S captured|G/S 捕捉|G/S 포착|G/S capturé|G/S erfasst|G/S capturado
FLARE 拉平|FLARE|FLARE フレア|FLARE 플레어|FLARE arrondi|FLARE Abfangen|FLARE enderezada
★ 场景完成:|★ Scenario complete:|★ シナリオ完了:|★ 시나리오 완료:|★ Scénario terminé :|★ Szenario abgeschlossen:|★ Escenario completado:
秒)|s)|秒)|초)|s)|s)|s)
秒|s|秒|초|s|s|s
正在装配飞机…|Preparing aircraft…|機体を準備中…|항공기 준비 중…|Préparation de l'avion…|Flugzeug wird vorbereitet…|Preparando avión…
启动飞行失败:|Failed to start flight:|フライト開始失敗:|비행 시작 실패:|Échec du démarrage du vol :|Flugstart fehlgeschlagen:|Error al iniciar vuelo:
启动失败:|Start failed:|起動失敗:|시작 실패:|Échec du démarrage :|Start fehlgeschlagen:|Error de inicio:
正在构建|Building|構築中|구축 중|Construction de|Erstelle|Construyendo
冷舱启动: 抬头看头顶板, 用鼠标点击开关 (BAT 1+2 → EXT PWR → …); ECAM 显示下一步, 按 ? 查看完整检查单|Cold & dark: look up at the overhead panel and click the switches (BAT 1+2 → EXT PWR → …); ECAM shows the next step, press ? for the full checklist|コールドスタート：オーバーヘッドパネルを見上げてスイッチをクリック（BAT 1+2 → EXT PWR → …）。ECAM に次の手順、? で全チェックリスト|콜드 스타트: 오버헤드 패널을 보고 스위치 클릭 (BAT 1+2 → EXT PWR → …); ECAM에 다음 단계, ?로 전체 체크리스트|Démarrage à froid : regardez le panneau supérieur et cliquez les interrupteurs (BAT 1+2 → EXT PWR → …) ; l'ECAM indique l'étape suivante, ? pour la check-list|Kaltstart: zum Overhead-Panel schauen und Schalter klicken (BAT 1+2 → EXT PWR → …); ECAM zeigt den nächsten Schritt, ? für die Checkliste|Arranque en frío: mire el panel superior y pulse los interruptores (BAT 1+2 → EXT PWR → …); ECAM muestra el siguiente paso, ? para la lista completa
起飞前: 按 ? 或 F1 查看操作说明 · C 切换视角 · N 看仪表板 · Tab 侧边面板 · M 鼠标驾驶杆|Before takeoff: press ? or F1 for help · C change view · N look at panel · Tab side panels · M mouse yoke|離陸前：? または F1 で操作説明 · C 視点 · N 計器盤 · Tab サイドパネル · M マウス操縦|이륙 전: ? 또는 F1 도움말 · C 시점 · N 계기판 · Tab 사이드 패널 · M 마우스 조종|Avant le décollage : ? ou F1 pour l'aide · C vue · N tableau · Tab panneaux · M manche souris|Vor dem Start: ? oder F1 Hilfe · C Ansicht · N Instrumente · Tab Seitenleisten · M Maussteuerung|Antes del despegue: ? o F1 ayuda · C vista · N panel · Tab paneles · M ratón
本版仅三维驾驶舱 (已取消 2D 六屏叠加)|This version uses the 3D cockpit only (2D six-screen overlay removed)|本バージョンは3Dコックピットのみ（2D 6画面は廃止）|이 버전은 3D 조종석만 (2D 6화면 제거)|Cette version n'a que le cockpit 3D (superposition 2D retirée)|Diese Version nur mit 3D-Cockpit (2D-Overlay entfernt)|Esta versión solo usa la cabina 3D (sin superposición 2D)
看向仪表板 (N 恢复向外看)|Looking at panel (N to look outside)|計器盤を表示（N で外を見る）|계기판 보기 (N으로 밖 보기)|Regard sur le tableau (N pour l'extérieur)|Blick auf Instrumente (N nach draußen)|Mirando el panel (N para el exterior)
向外看|Looking outside|外を見る|밖 보기|Regard extérieur|Blick nach draußen|Mirando al exterior
TERRAIN — 拉起!|TERRAIN — PULL UP!|TERRAIN — 引き起こせ!|TERRAIN — 상승하라!|TERRAIN — PULL UP !|TERRAIN — HOCHZIEHEN!|TERRAIN — ¡ARRIBA!
已暂停 (空格 / P 继续)|Paused (Space / P to resume)|一時停止（スペース／P で再開）|일시정지 (스페이스 / P로 계속)|En pause (Espace / P pour reprendre)|Pausiert (Leertaste / P zum Fortsetzen)|En pausa (Espacio / P para reanudar)
继续|Resumed|再開|계속|Reprise|Weiter|Reanudado
侧杆按钮断开|Disconnected by sidestick button|サイドスティックボタンで解除|사이드스틱 버튼으로 해제|Déconnecté par bouton du mini-manche|Per Sidestick-Taste getrennt|Desconectado con botón del sidestick
放下|down|下げ|내림|sorti|aus|abajo
收上|up|上げ|올림|rentré|ein|arriba
油门 慢车|Thrust idle|推力 アイドル|추력 아이들|Manettes ralenti|Schub Leerlauf|Empuje ralentí
油门 爬升推力|Thrust climb|推力 上昇|추력 상승|Manettes montée|Schub Steigflug|Empuje ascenso
起飞推力 TOGA|Takeoff thrust TOGA|離陸推力 TOGA|이륙 추력 TOGA|Poussée décollage TOGA|Startschub TOGA|Empuje de despegue TOGA
解除|disarmed|解除|해제|désarmé|entschärft|desarmado
速度模式 SPD|Speed mode SPD|速度モード SPD|속도 모드 SPD|Mode vitesse SPD|Geschwindigkeitsmodus SPD|Modo velocidad SPD
速度模式 MACH|Speed mode MACH|速度モード MACH|속도 모드 MACH|Mode vitesse MACH|Geschwindigkeitsmodus MACH|Modo velocidad MACH
无法起动 APU — 请先接通电池 (Shift+E)|Cannot start APU — turn the battery on first (Shift+E)|APU 始動不可 — 先にバッテリーをオン (Shift+E)|APU 시동 불가 — 먼저 배터리를 켜세요 (Shift+E)|APU impossible — allumez d'abord la batterie (Maj+E)|APU-Start nicht möglich — zuerst Batterie ein (Umschalt+E)|No se puede arrancar el APU — encienda la batería (Mayús+E)
无法起动发动机 — 无电源|Cannot start engines — no power|エンジン始動不可 — 電源なし|엔진 시동 불가 — 전원 없음|Démarrage impossible — pas d'alimentation|Triebwerksstart nicht möglich — kein Strom|No se pueden arrancar motores — sin energía
发动机 1 起动中|Engine 1 starting|エンジン 1 始動中|엔진 1 시동 중|Moteur 1 en démarrage|Triebwerk 1 startet|Motor 1 arrancando
已静音|Muted|ミュート|음소거됨|Son coupé|Stumm|Silenciado
取消静音|Unmuted|ミュート解除|음소거 해제|Son activé|Ton an|Sonido activado
时间倍率 ×|Time rate ×|時間倍率 ×|시간 배율 ×|Vitesse du temps ×|Zeitraffer ×|Velocidad del tiempo ×
已保存截图|Screenshot saved|スクリーンショットを保存|스크린샷 저장됨|Capture enregistrée|Screenshot gespeichert|Captura guardada
截图失败|Screenshot failed|スクリーンショット失敗|스크린샷 실패|Échec de la capture|Screenshot fehlgeschlagen|Error en la captura
缺少模块:|Missing module:|モジュールがありません:|모듈 누락:|Module manquant :|Modul fehlt:|Falta el módulo:
请确认 js/ 目录下的所有文件都存在|Make sure all files in the js/ folder are present|js/ フォルダーのファイルがすべてあるか確認してください|js/ 폴더의 모든 파일이 있는지 확인하세요|Vérifiez que tous les fichiers du dossier js/ sont présents|Prüfen, ob alle Dateien im Ordner js/ vorhanden sind|Compruebe que estén todos los archivos de js/
种机型 ·|aircraft ·|機種 ·|기종 ·|avions ·|Flugzeuge ·|aviones ·
个机场|airports|空港|공항|aéroports|Flughäfen|aeropuertos
音频引擎不可用 (浏览器不支持或未授权)|Audio unavailable (not supported or not allowed by browser)|オーディオ使用不可（ブラウザ非対応または未許可）|오디오 사용 불가 (브라우저 미지원 또는 미허용)|Audio indisponible (non pris en charge ou non autorisé)|Audio nicht verfügbar (nicht unterstützt oder nicht erlaubt)|Audio no disponible (no compatible o no permitido)
起动前|Before Start|始動前|시동 전|Avant démarrage|Vor dem Anlassen|Antes del arranque
起动后|After Start|始動後|시동 후|Après démarrage|Nach dem Anlassen|Después del arranque
滑行|Taxi|タキシング|지상 활주|Roulage|Rollen|Rodaje
起飞前|Before Takeoff|離陸前|이륙 전|Avant décollage|Vor dem Start|Antes del despegue
起飞后|After Takeoff|離陸後|이륙 후|Après décollage|Nach dem Start|Después del despegue
进近|Approach|進入|접근|Approche|Anflug|Aproximación
着陆|Landing|着陸|착륙|Atterrissage|Landung|Aterrizaje
着陆后|After Landing|着陸後|착륙 후|Après atterrissage|Nach der Landung|Después del aterrizaje
停机|Parking|駐機|주기|Parking|Parken|Estacionamiento
电瓶 BAT 1 / BAT 2|Batteries BAT 1 / BAT 2|バッテリー BAT 1 / BAT 2|배터리 BAT 1 / BAT 2|Batteries BAT 1 / BAT 2|Batterien BAT 1 / BAT 2|Baterías BAT 1 / BAT 2
外部电源 / APU 发电|External power / APU gen|外部電源 / APU 発電|외부 전원 / APU 발전|Groupe de parc / génératrice APU|Außenstrom / APU-Generator|Energía externa / generador APU
APU 主开关 / START|APU master / START|APU マスター / START|APU 마스터 / START|APU master / START|APU-Master / START|APU master / START
APU 引气|APU bleed|APU ブリード|APU 블리드|Prélèvement APU|APU-Zapfluft|Sangrado APU
防冰|Anti-ice|防氷|방빙|Antigivrage|Enteisung|Antihielo
航行灯 / 信标灯|Nav / beacon lights|航法灯 / ビーコン|항법등 / 비컨|Feux nav / anticollision|Positions- / Beacon-Licht|Luces nav / baliza
自动驾驶 / 飞行指引|Autopilot / flight director|AP / FD|오토파일럿 / FD|PA / directeur de vol|Autopilot / Flugregler|AP / director de vuelo
襟翼手柄|Flap lever|フラップレバー|플랩 레버|Levier de volets|Klappenhebel|Palanca de flaps
起飞位设定|takeoff setting|離陸位置に設定|이륙 위치 설정|position décollage|Startstellung|posición de despegue
起飞位|takeoff|離陸位置|이륙 위치|décollage|Startstellung|despegue
液压|Hydraulics|油圧|유압|Hydraulique|Hydraulik|Hidráulica
正常|normal|正常|정상|normal|normal|normal
空调 / 增压|Air cond / pressurization|空調 / 与圧|공조 / 여압|Climatisation / pressurisation|Klima / Druck|Aire acond. / presurización
发动机防冰|Engine anti-ice|エンジン防氷|엔진 방빙|Antigivrage moteurs|Triebwerksenteisung|Antihielo de motores
防滞 / 自动刹车|Anti-skid / autobrake|アンチスキッド / オートブレーキ|안티스키드 / 오토브레이크|Antidérapage / autofreinage|Antiskid / Autobremse|Antideslizante / autofreno
飞行操纵 检查|Flight controls check|操縦系統 点検|비행 조종 점검|Commandes de vol vérif.|Steuerung prüfen|Controles de vuelo verif.
配平|Trim|トリム|트림|Trim|Trimmung|Compensación
刹车检查|Brake check|ブレーキ点検|브레이크 점검|Vérif. freins|Bremsprobe|Prueba de frenos
飞行仪表|Flight instruments|飛行計器|비행 계기|Instruments de vol|Fluginstrumente|Instrumentos de vuelo
已设定|set|設定済み|설정됨|réglées|gesetzt|fijadas
起飞数据|Takeoff data|離陸データ|이륙 데이터|Données décollage|Startdaten|Datos de despegue
外侧灯 / 起飞灯|Exterior / takeoff lights|外部灯 / 離陸灯|외부등 / 이륙등|Feux ext. / décollage|Außen- / Startlicht|Luces ext. / despegue
客舱|Cabin|客室|객실|Cabine|Kabine|Cabina
起飞灯|Takeoff lights|離陸灯|이륙등|Feux décollage|Startlicht|Luces de despegue
增压|Pressurization|与圧|여압|Pressurisation|Druckkabine|Presurización
按速度收上|retract on speed|速度に応じて格納|속도에 따라 수납|rentrer selon vitesse|nach Fahrt einfahren|retraer según velocidad
QNH 设定|QNH set|QNH 設定|QNH 설정|QNH réglé|QNH gesetzt|QNH fijado
进近图 / 跑道|Approach chart / runway|進入チャート / 滑走路|접근 차트 / 활주로|Carte d'approche / piste|Anflugkarte / Piste|Carta de aproximación / pista
ILS 频率 / 航道|ILS frequency / course|ILS 周波数 / コース|ILS 주파수 / 코스|Fréquence / axe ILS|ILS-Frequenz / Kurs|Frecuencia / curso ILS
设定|set|設定|설정|réglé|gesetzt|fijado
APPR 预位|APPR armed|APPR アーム|APPR 준비|APPR armé|APPR scharf|APPR armado
着陆位|landing|着陸位置|착륙 위치|atterrissage|Landestellung|aterrizaje
DOWN 3 绿|DOWN 3 green|DOWN 3 グリーン|DOWN 3 녹색|DOWN 3 vertes|DOWN 3 grün|DOWN 3 verdes
扰流板|Spoilers|スポイラー|스포일러|Spoilers|Spoiler|Spoilers
已确认|confirmed|確認済み|확인됨|confirmé|bestätigt|confirmado
气象雷达|Weather radar|気象レーダー|기상 레이더|Radar météo|Wetterradar|Radar meteorológico
冷舱启动|Cold & Dark|コールド＆ダーク|콜드 앤 다크|Démarrage à froid|Kaltstart|Arranque en frío
飞机完全断电停靠在停机坪的机位上。接通电池、启动 APU、起动发动机, 推出后滑行至跑道。|The aircraft is fully powered down at a stand. Turn on the batteries, start the APU and engines, push back and taxi to the runway.|機体はスポットで完全に電源オフ。バッテリーを入れ、APU とエンジンを始動し、プッシュバックして滑走路へタキシング。|항공기는 주기장에서 전원이 완전히 꺼진 상태입니다. 배터리를 켜고 APU와 엔진을 시동한 뒤 푸시백하여 활주로로 이동하세요.|L'avion est entièrement éteint au poste. Allumez les batteries, démarrez l'APU et les moteurs, repoussez et roulez vers la piste.|Das Flugzeug steht stromlos an der Parkposition. Batterien ein, APU und Triebwerke starten, zurückschieben und zur Piste rollen.|El avión está totalmente apagado en el puesto. Encienda las baterías, arranque el APU y los motores, haga pushback y ruede a la pista.
按 Shift+E 接通电池与电源 (座舱点亮), 再按 Shift+A 接通 APU; 等待 APU 可用后按 Ctrl+S 起动全部发动机; 松开停留刹车 (Shift+B) 后按 Shift+P 推出, 再滑行至跑道。|Press Shift+E for batteries and power (cockpit lights up), then Shift+A for the APU; when the APU is available press Ctrl+S to start all engines; release the parking brake (Shift+B), press Shift+P to push back, then taxi to the runway.|Shift+E でバッテリーと電源（コックピット点灯）、Shift+A で APU。APU 使用可能後 Ctrl+S で全エンジン始動。パーキングブレーキ解除（Shift+B）後 Shift+P でプッシュバックし滑走路へ。|Shift+E로 배터리와 전원 (조종석 점등), Shift+A로 APU; APU 사용 가능 후 Ctrl+S로 모든 엔진 시동; 주차 브레이크 해제 (Shift+B) 후 Shift+P로 푸시백, 활주로로 이동.|Maj+E pour batteries et alimentation (cockpit allumé), puis Maj+A pour l'APU ; APU disponible, Ctrl+S démarre tous les moteurs ; relâchez le frein de parking (Maj+B), Maj+P pour repousser, puis roulez.|Umschalt+E für Batterie und Strom (Cockpit leuchtet), dann Umschalt+A für die APU; wenn verfügbar Strg+S für alle Triebwerke; Parkbremse lösen (Umschalt+B), Umschalt+P zum Zurückschieben, dann rollen.|Mayús+E para baterías y energía (cabina encendida), luego Mayús+A para el APU; con APU disponible, Ctrl+S arranca los motores; suelte el freno (Mayús+B), Mayús+P para pushback y ruede a la pista.
停机坪|Apron|エプロン|계류장|Aire de trafic|Vorfeld|Plataforma
接通电瓶 BAT 1 + BAT 2 与外部电源 EXT PWR|Turn on BAT 1 + BAT 2 and EXT PWR|BAT 1 + BAT 2 と EXT PWR をオン|BAT 1 + BAT 2와 EXT PWR 켜기|Allumer BAT 1 + BAT 2 et EXT PWR|BAT 1 + BAT 2 und EXT PWR ein|Encender BAT 1 + BAT 2 y EXT PWR
ADIRS 置 NAV 并完成对准|Set ADIRS to NAV and complete alignment|ADIRS を NAV にしてアライン完了|ADIRS를 NAV로 하고 정렬 완료|ADIRS sur NAV, alignement terminé|ADIRS auf NAV, Ausrichtung abschließen|ADIRS en NAV y completar alineación
燃油泵 ON, 信标灯 BEACON ON|Fuel pumps ON, BEACON ON|燃料ポンプ ON、BEACON ON|연료 펌프 ON, BEACON ON|Pompes carburant ON, BEACON ON|Kraftstoffpumpen ON, BEACON ON|Bombas de combustible ON, BEACON ON
APU MASTER + START, 等待 APU AVAIL|APU MASTER + START, wait for APU AVAIL|APU MASTER + START、APU AVAIL を待つ|APU MASTER + START, APU AVAIL 대기|APU MASTER + START, attendre APU AVAIL|APU MASTER + START, auf APU AVAIL warten|APU MASTER + START, esperar APU AVAIL
APU BLEED ON (起动引气)|APU BLEED ON (start air)|APU BLEED ON（始動用空気）|APU BLEED ON (시동 공기)|APU BLEED ON (air de démarrage)|APU BLEED ON (Startluft)|APU BLEED ON (aire de arranque)
起动两台发动机至慢车|Start both engines to idle|両エンジンをアイドルまで始動|양쪽 엔진을 아이들까지 시동|Démarrer les deux moteurs au ralenti|Beide Triebwerke auf Leerlauf starten|Arrancar ambos motores a ralentí
松开停留刹车|Release the parking brake|パーキングブレーキ解除|주차 브레이크 해제|Relâcher le frein de parking|Parkbremse lösen|Soltar freno de estacionamiento
推出离开停机位 (Shift+P)|Push back from the stand (Shift+P)|スポットからプッシュバック (Shift+P)|주기장에서 푸시백 (Shift+P)|Repousser du poste (Maj+P)|Von der Position zurückschieben (Umschalt+P)|Pushback desde el puesto (Mayús+P)
滑行速度不超过 25 kt|Taxi at no more than 25 kt|25 kt 以下でタキシング|25 kt 이하로 지상 활주|Rouler à 25 kt maximum|Mit max. 25 kt rollen|Rodar a no más de 25 kt
正常起飞|Normal Takeoff|通常離陸|일반 이륙|Décollage normal|Normaler Start|Despegue normal
已在跑道头对正。襟翼已设定, 发动机运转中。推油门至起飞推力, 抬前轮, 按 V2 爬升。|Lined up on the runway with flaps set and engines running. Advance to takeoff thrust, rotate and climb at V2.|滑走路端で整列済み。フラップ設定済み、エンジン作動中。離陸推力にし、機首上げ、V2 で上昇。|활주로에 정렬됨. 플랩 설정, 엔진 작동 중. 이륙 추력으로 올리고 기수를 들어 V2로 상승.|Aligné sur la piste, volets réglés, moteurs en marche. Poussez au décollage, effectuez la rotation et montez à V2.|Auf der Piste ausgerichtet, Klappen gesetzt, Triebwerke laufen. Startschub setzen, rotieren, mit V2 steigen.|Alineado en la pista, flaps fijados y motores en marcha. Empuje de despegue, rote y ascienda a V2.
按 8 设定起飞推力 (TOGA), 达到 VR 后按 ↓ (或 S) 抬前轮。|Press 8 for takeoff thrust (TOGA); at VR press ↓ (or S) to rotate.|8 で離陸推力 (TOGA)、VR で ↓（または S）で機首上げ。|8로 이륙 추력 (TOGA), VR에서 ↓ (또는 S)로 기수 올림.|8 pour la poussée décollage (TOGA) ; à VR, ↓ (ou S) pour la rotation.|8 für Startschub (TOGA); bei VR ↓ (oder S) zum Rotieren.|Pulse 8 para TOGA; en VR pulse ↓ (o S) para rotar.
推至起飞推力 (N1 > 90%)|Set takeoff thrust (N1 > 90%)|離陸推力に (N1 > 90%)|이륙 추력 설정 (N1 > 90%)|Poussée décollage (N1 > 90 %)|Startschub setzen (N1 > 90 %)|Empuje de despegue (N1 > 90 %)
达到 VR 后抬前轮|Rotate at VR|VR で機首上げ|VR에서 기수 올림|Rotation à VR|Bei VR rotieren|Rotar en VR
离地后收起飞襟翼|Retract takeoff flaps after liftoff|離陸後フラップ格納|이륙 후 플랩 수납|Rentrer les volets après l'envol|Nach dem Abheben Klappen einfahren|Retraer flaps tras el despegue
收上起落架|Raise the gear|ギア上げ|기어 올림|Rentrer le train|Fahrwerk einfahren|Subir el tren
爬升至 5000 ft|Climb to 5000 ft|5000 ft まで上昇|5000 ft까지 상승|Monter à 5000 ft|Auf 5000 ft steigen|Ascender a 5000 ft
巡航飞行|Cruise Flight|巡航飛行|순항 비행|Vol de croisière|Reiseflug|Vuelo de crucero
已在巡航高度以经济马赫数飞行。练习自动驾驶模式切换、高度/速度选择、航路导航。|Cruising at economy Mach. Practice autopilot modes, altitude/speed selection and route navigation.|巡航高度を経済マッハで飛行中。AP モード切替、高度／速度選択、航法を練習。|순항 고도에서 경제 마하로 비행 중. 오토파일럿 모드, 고도/속도 선택, 항로 항법 연습.|En croisière au Mach économique. Entraînez-vous aux modes PA, sélection altitude/vitesse et navigation.|Reiseflug mit Spar-Mach. Autopilot-Modi, Höhen-/Geschwindigkeitswahl und Navigation üben.|En crucero a Mach económico. Practique modos de AP, selección de altitud/velocidad y navegación.
使用 H 选择航向, L 保持高度, J 接通 LNAV。|Use H for heading select, L for altitude hold, J for LNAV.|H で方位選択、L で高度保持、J で LNAV。|H 방위 선택, L 고도 유지, J LNAV.|H : cap sélecté, L : maintien d'altitude, J : LNAV.|H Kurswahl, L Höhe halten, J LNAV.|H rumbo, L mantener altitud, J LNAV.
保持高度 ±100 ft 以内 60 秒|Hold altitude within ±100 ft for 60 s|±100 ft 以内で60秒高度保持|60초간 ±100 ft 이내 고도 유지|Tenir l'altitude à ±100 ft pendant 60 s|Höhe 60 s auf ±100 ft halten|Mantener altitud ±100 ft durante 60 s
切换至 LNAV 沿航路飞行|Switch to LNAV and follow the route|LNAV に切替えてルートを飛行|LNAV로 전환하여 항로 비행|Passer en LNAV et suivre la route|Auf LNAV wechseln und Route folgen|Cambiar a LNAV y seguir la ruta
试验 V/S 模式爬升至 FL370|Try V/S mode to climb to FL370|V/S モードで FL370 へ上昇|V/S 모드로 FL370까지 상승|Monter au FL370 en mode V/S|Mit V/S auf FL370 steigen|Ascender a FL370 en modo V/S
观察燃油流量与 EGT|Watch fuel flow and EGT|燃料流量と EGT を観察|연료 유량과 EGT 관찰|Surveiller débit carburant et EGT|Kraftstofffluss und EGT beobachten|Observar flujo de combustible y EGT
ILS 精密进近|ILS Precision Approach|ILS 精密進入|ILS 정밀 접근|Approche de précision ILS|ILS-Präzisionsanflug|Aproximación de precisión ILS
从跑道中心线延长线 12 海里处开始, 截获航向道与下滑道, 跟随指引下降至决断高度。|Start 12 nm out on the extended centerline, capture localizer and glideslope, and follow guidance down to decision height.|延長中心線上 12 nm から開始、ローカライザーとグライドスロープを捕捉し決心高度まで降下。|연장 중심선 12 nm에서 시작, 로컬라이저와 글라이드슬로프를 포착하여 결심 고도까지 강하.|Départ à 12 NM dans l'axe, capturez localizer et glide, descendez jusqu'à la hauteur de décision.|Start 12 NM auf der verlängerten Mittellinie, Localizer und Gleitpfad erfassen, bis zur Entscheidungshöhe sinken.|Empiece a 12 NM en el eje extendido, capture localizador y senda y descienda hasta la altura de decisión.
按 I 预位 APPR, 截获 LOC 与 GS 后飞机自动跟随。|Press I to arm APPR; after LOC and GS capture the aircraft follows automatically.|I で APPR アーム、LOC と GS 捕捉後は自動追従。|I로 APPR 준비, LOC와 GS 포착 후 자동 추종.|I pour armer APPR ; après capture LOC et GS l'avion suit seul.|I zum Scharfschalten von APPR; nach LOC/GS folgt das Flugzeug automatisch.|Pulse I para armar APPR; tras capturar LOC y GS el avión sigue solo.
截获航向道 (LOC)|Capture the localizer (LOC)|ローカライザー捕捉 (LOC)|로컬라이저 포착 (LOC)|Capturer le localizer (LOC)|Localizer erfassen (LOC)|Capturar localizador (LOC)
截获下滑道 (GS)|Capture the glideslope (GS)|グライドスロープ捕捉 (GS)|글라이드슬로프 포착 (GS)|Capturer le glide (GS)|Gleitpfad erfassen (GS)|Capturar senda (GS)
放下起落架|Lower the gear|ギア下げ|기어 내림|Sortir le train|Fahrwerk ausfahren|Bajar el tren
着陆襟翼设定|Set landing flaps|着陸フラップ設定|착륙 플랩 설정|Volets atterrissage|Landeklappen setzen|Flaps de aterrizaje
在跑道范围内接地|Touch down on the runway|滑走路内で接地|활주로 내 접지|Toucher sur la piste|Auf der Piste aufsetzen|Tomar contacto en la pista
接地垂直速度小于 -400 fpm|Touchdown rate gentler than -400 fpm|接地時の降下率 -400 fpm 未満|접지 강하율 -400 fpm 미만|Vitesse verticale au toucher < 400 fpm|Sinkrate beim Aufsetzen unter 400 fpm|Régimen al tocar menor de 400 fpm
接地垂直速度小于 -500 fpm|Touchdown rate gentler than -500 fpm|接地時の降下率 -500 fpm 未満|접지 강하율 -500 fpm 미만|Vitesse verticale au toucher < 500 fpm|Sinkrate beim Aufsetzen unter 500 fpm|Régimen al tocar menor de 500 fpm
侧风着陆挑战|Crosswind Landing Challenge|横風着陸チャレンジ|측풍 착륙 도전|Défi atterrissage vent de travers|Seitenwindlandung|Desafío de viento cruzado
25 节正侧风、中等湍流。练习蟹形进近与拉平接地, 保持跑道中心线。|25 kt direct crosswind with moderate turbulence. Practice crabbed approaches and flares while holding the centerline.|25 kt の真横風、中程度の乱気流。クラブ進入とフレアを練習し中心線を保持。|25 kt 정측풍, 중간 난기류. 크랩 접근과 플레어를 연습하며 중심선 유지.|Vent de travers de 25 kt, turbulence modérée. Entraînez-vous à l'approche en crabe et à l'arrondi dans l'axe.|25 kt Seitenwind, mäßige Turbulenz. Vorhalteanflug und Abfangen auf der Mittellinie üben.|Viento cruzado de 25 kt con turbulencia moderada. Practique la aproximación en cangrejo y la enderezada en el eje.
用方向舵消除偏流, 落地前用交叉操纵对正跑道。|Use rudder to remove the crab and cross-control to align before touchdown.|ラダーで偏流を消し、接地前にクロスコントロールで整列。|방향타로 편류를 없애고 접지 전 크로스 컨트롤로 정렬.|Utilisez la direction pour décraber et les commandes croisées avant le toucher.|Mit Seitenruder ausrichten und vor dem Aufsetzen kreuzsteuern.|Use el timón para quitar el cangrejo y controles cruzados antes de tocar.
保持航向道偏差小于半个点|Keep localizer deviation under half a dot|ローカライザー偏差を半ドット以内に|로컬라이저 편차를 반 도트 이내로|Écart localizer inférieur à un demi-point|LOC-Ablage unter einem halben Punkt|Desviación del localizador menor de medio punto
放下起落架与着陆襟翼|Lower gear and landing flaps|ギアと着陸フラップを下げる|기어와 착륙 플랩 내림|Sortir train et volets atterrissage|Fahrwerk und Landeklappen ausfahren|Bajar tren y flaps de aterrizaje
落地后保持在跑道上 (不冲出)|Stay on the runway after landing (no excursion)|着陸後滑走路上に留まる（逸脱なし）|착륙 후 활주로 유지 (이탈 없음)|Rester sur la piste (pas de sortie)|Nach der Landung auf der Piste bleiben|Permanecer en la pista tras aterrizar
本场五边航线|Traffic Pattern|場周経路|장주 비행|Tour de piste|Platzrunde|Circuito de tránsito
在机场上空完成标准的五边起落航线: 起飞、爬升、四转弯、下风边、三转弯、对正落地。|Fly a standard traffic pattern: takeoff, climb, crosswind, downwind, base and final to landing.|標準の場周経路を飛行：離陸、上昇、クロスウインド、ダウンウインド、ベース、ファイナルで着陸。|표준 장주 비행: 이륙, 상승, 크로스윈드, 다운윈드, 베이스, 파이널 착륙.|Effectuez un tour de piste standard : décollage, montée, vent traversier, vent arrière, base et finale.|Standard-Platzrunde: Start, Steigflug, Querabflug, Gegenanflug, Queranflug, Endanflug.|Vuele un circuito estándar: despegue, ascenso, viento cruzado, viento en cola, base y final.
保持 1500 ft AGL, 下风边与跑道平行, 三转弯后放襟翼与起落架。|Hold 1500 ft AGL, fly downwind parallel to the runway, extend flaps and gear after the base turn.|1500 ft AGL を保持、ダウンウインドは滑走路と平行、ベースターン後にフラップとギア。|1500 ft AGL 유지, 다운윈드는 활주로와 평행, 베이스 선회 후 플랩과 기어.|Tenez 1500 ft sol, vent arrière parallèle à la piste, volets et train après le virage de base.|1500 ft AGL halten, Gegenanflug parallel zur Piste, nach dem Queranflug Klappen und Fahrwerk.|Mantenga 1500 ft AGL, viento en cola paralelo a la pista, flaps y tren tras el viraje a base.
起飞并爬升至 1500 ft AGL|Take off and climb to 1500 ft AGL|離陸し 1500 ft AGL まで上昇|이륙 후 1500 ft AGL까지 상승|Décoller et monter à 1500 ft sol|Starten und auf 1500 ft AGL steigen|Despegar y ascender a 1500 ft AGL
收上起落架与襟翼|Retract gear and flaps|ギアとフラップを格納|기어와 플랩 수납|Rentrer train et volets|Fahrwerk und Klappen einfahren|Retraer tren y flaps
完成一次完整转弯|Complete a full circuit turn|一周旋回を完了|완전한 선회 1회 완료|Effectuer un virage complet|Eine volle Kurve fliegen|Completar un viraje completo
再次安全接地|Touch down safely again|再び安全に接地|다시 안전하게 접지|Toucher à nouveau en sécurité|Erneut sicher aufsetzen|Volver a tomar contacto con seguridad
单发失效处置|Engine Failure|片発故障対処|단발 고장 처치|Panne moteur|Triebwerksausfall|Fallo de motor
巡航中一台发动机失效。识别故障、保持航向、执行单发程序并安全返场。|An engine fails in cruise. Identify it, hold heading, run the single-engine procedure and return safely.|巡航中に1基故障。故障を特定し方位を保持、片発手順を実施して安全に帰還。|순항 중 엔진 1기 고장. 고장을 식별하고 방위를 유지하며 단발 절차를 수행해 안전 귀환.|Un moteur tombe en panne en croisière. Identifiez-le, tenez le cap, appliquez la procédure et revenez en sécurité.|Ein Triebwerk fällt im Reiseflug aus. Erkennen, Kurs halten, Einmotorenverfahren und sicher zurückkehren.|Un motor falla en crucero. Identifíquelo, mantenga rumbo, aplique el procedimiento y regrese con seguridad.
蹬舵抵消偏航, 保持空速, 另一台发动机推至最大。|Use rudder against the yaw, hold airspeed and set the other engine to max.|ラダーでヨーを打ち消し、速度を保ち、他方のエンジンを最大に。|방향타로 요를 상쇄, 속도 유지, 다른 엔진 최대.|Contrez le lacet à la direction, tenez la vitesse, moteur restant plein gaz.|Gier mit Seitenruder ausgleichen, Fahrt halten, anderes Triebwerk auf Maximum.|Contrarreste la guiñada con timón, mantenga velocidad y el otro motor al máximo.
左发失效 · FL280|Left engine failure · FL280|左エンジン故障 · FL280|왼쪽 엔진 고장 · FL280|Panne moteur gauche · FL280|Linkes Triebwerk aus · FL280|Fallo motor izquierdo · FL280
识别失效发动机|Identify the failed engine|故障エンジンを特定|고장 엔진 식별|Identifier le moteur en panne|Ausgefallenes Triebwerk erkennen|Identificar el motor fallado
用方向舵消除偏航 (±10° 以内)|Counter yaw with rudder (within ±10°)|ラダーでヨー修正（±10°以内）|방향타로 요 수정 (±10° 이내)|Contrer le lacet (±10°)|Gier mit Seitenruder ausgleichen (±10°)|Contrarrestar guiñada (±10°)
保持单发最佳爬升速度|Hold single-engine best climb speed|片発最良上昇速度を保持|단발 최적 상승 속도 유지|Tenir la vitesse de montée optimale monomoteur|Beste Einmotoren-Steiggeschwindigkeit halten|Mantener velocidad óptima monomotor
另一台发动机推至最大|Set the other engine to max thrust|他方のエンジンを最大推力に|다른 엔진 최대 추력|Moteur restant plein gaz|Anderes Triebwerk auf Maximalschub|Otro motor a empuje máximo
稳定下降至 10000 ft|Descend steadily to 10,000 ft|10000 ft まで安定降下|10000 ft까지 안정 강하|Descendre régulièrement à 10 000 ft|Gleichmäßig auf 10.000 ft sinken|Descender estable a 10 000 ft
夜间飞行|Night Flight|夜間飛行|야간 비행|Vol de nuit|Nachtflug|Vuelo nocturno
夜间进近。跑道灯光、城市灯火与仪表飞行。练习依靠仪表保持姿态。|Night approach with runway lights, city lights and instrument flying. Practice holding attitude on instruments.|夜間進入。滑走路灯、街の灯り、計器飛行。計器で姿勢保持を練習。|야간 접근. 활주로 조명, 도시 불빛, 계기 비행. 계기로 자세 유지 연습.|Approche de nuit : balisage, lumières de la ville et vol aux instruments. Tenez l'assiette aux instruments.|Nachtanflug mit Pistenbefeuerung, Stadtlichtern und Instrumentenflug. Fluglage nach Instrumenten halten.|Aproximación nocturna con luces de pista y ciudad y vuelo por instrumentos. Practique mantener actitud.
注意 PFD 姿态, 夜间很容易产生空间定向障碍。|Watch the PFD attitude — spatial disorientation is easy at night.|PFD の姿勢に注意。夜間は空間識失調に陥りやすい。|PFD 자세에 주의, 야간에는 비행 착각이 쉽게 발생합니다.|Surveillez l'assiette au PFD : la désorientation est facile de nuit.|PFD-Fluglage beachten — nachts droht räumliche Desorientierung.|Vigile la actitud en el PFD: la desorientación es fácil de noche.
当地 21:30 ·|Local 21:30 ·|現地 21:30 ·|현지 21:30 ·|Locale 21:30 ·|Ortszeit 21:30 ·|Local 21:30 ·
保持姿态稳定 (滚转 < 15°)|Keep attitude stable (bank < 15°)|姿勢を安定（バンク < 15°）|자세 안정 유지 (경사 < 15°)|Assiette stable (inclinaison < 15°)|Fluglage stabil (Querneigung < 15°)|Actitud estable (alabeo < 15°)
截获 ILS 下滑道|Capture the ILS glideslope|ILS グライドスロープ捕捉|ILS 글라이드슬로프 포착|Capturer le glide ILS|ILS-Gleitpfad erfassen|Capturar senda ILS
打开着陆灯与频闪灯|Turn on landing and strobe lights|着陸灯とストロボをオン|착륙등과 스트로브 켜기|Allumer phares et feux à éclats|Lande- und Blitzlichter ein|Encender luces de aterrizaje y estrobos
安全着陆|Land safely|安全に着陸|안전 착륙|Atterrir en sécurité|Sicher landen|Aterrizar con seguridad
雷雨起飞|Thunderstorm Takeoff|雷雨離陸|뇌우 이륙|Décollage sous orage|Start bei Gewitter|Despegue con tormenta
低能见度、强降雨与风切变环境下起飞。注意发动机参数与跑道积水对刹车的影响。|Take off in low visibility, heavy rain and wind shear. Watch engine parameters and how standing water affects braking.|低視程・豪雨・ウインドシア下での離陸。エンジン計器と滑走路の水たまりによるブレーキへの影響に注意。|저시정, 폭우, 윈드시어 속 이륙. 엔진 계기와 활주로 고인 물이 제동에 미치는 영향에 주의.|Décollage par faible visibilité, forte pluie et cisaillement. Surveillez les paramètres moteur et l'effet de l'eau sur le freinage.|Start bei schlechter Sicht, Starkregen und Windscherung. Triebwerkswerte und Bremswirkung bei Nässe beachten.|Despegue con baja visibilidad, lluvia intensa y cizalladura. Vigile los motores y el efecto del agua en la frenada.
湿滑跑道刹车效率下降, 起飞距离变长。|Wet runways reduce braking and lengthen the takeoff roll.|濡れた滑走路ではブレーキ効率が下がり、離陸距離が延びる。|젖은 활주로는 제동 효율이 떨어지고 이륙 거리가 길어집니다.|Une piste mouillée réduit le freinage et allonge le décollage.|Nasse Pisten verringern die Bremswirkung und verlängern den Startlauf.|La pista mojada reduce la frenada y alarga la carrera.
强雷暴 · 湿滑跑道|Severe thunderstorm · wet runway|激しい雷雨 · 濡れた滑走路|강한 뇌우 · 젖은 활주로|Orage violent · piste mouillée|Schweres Gewitter · nasse Piste|Tormenta fuerte · pista mojada
在湿滑跑道上加速至 VR|Accelerate to VR on the wet runway|濡れた滑走路で VR まで加速|젖은 활주로에서 VR까지 가속|Accélérer jusqu'à VR sur piste mouillée|Auf nasser Piste auf VR beschleunigen|Acelerar hasta VR en pista mojada
安全离地 (未冲出跑道)|Lift off safely (no runway excursion)|安全に離陸（逸脱なし）|안전하게 이륙 (이탈 없음)|Décoller en sécurité (sans sortie de piste)|Sicher abheben (ohne Pistenabkommen)|Despegar con seguridad (sin salirse)
爬升穿越颠簸层至 10000 ft|Climb through the turbulence to 10,000 ft|乱気流層を抜けて 10000 ft まで上昇|난기류층을 지나 10000 ft까지 상승|Monter à travers la turbulence jusqu'à 10 000 ft|Durch die Turbulenz auf 10.000 ft steigen|Ascender atravesando la turbulencia a 10 000 ft
自由|Free|フリー|자유|Libre|Frei|Libre
没有目标, 没有限制。从跑道起飞, 自由探索这个世界。|No goals, no limits. Take off and explore the world.|目標も制限もなし。滑走路から離陸し自由に世界を探索。|목표도 제한도 없습니다. 이륙하여 자유롭게 세계를 탐험하세요.|Pas d'objectifs, pas de limites. Décollez et explorez le monde.|Keine Ziele, keine Grenzen. Starten und die Welt erkunden.|Sin objetivos ni límites. Despegue y explore el mundo.
按 C 切换视角, 按 空格 或 P 暂停, 按 ? 或 F1 查看操作说明。|Press C to change view, Space or P to pause, ? or F1 for help.|C で視点切替、スペースまたは P で一時停止、? または F1 で操作説明。|C 시점 전환, 스페이스 또는 P 일시정지, ? 또는 F1 도움말.|C pour changer de vue, Espace ou P pour pause, ? ou F1 pour l'aide.|C Ansicht, Leertaste oder P Pause, ? oder F1 Hilfe.|C para cambiar vista, Espacio o P para pausa, ? o F1 para ayuda.
无限制|Unlimited|制限なし|제한 없음|Illimité|Unbegrenzt|Sin límites
未知场景:|Unknown scenario:|不明なシナリオ:|알 수 없는 시나리오:|Scénario inconnu :|Unbekanntes Szenario:|Escenario desconocido:
场景初始化失败:|Scenario init failed:|シナリオ初期化失敗:|시나리오 초기화 실패:|Échec d'initialisation du scénario :|Szenario-Initialisierung fehlgeschlagen:|Error al iniciar escenario:
地形: Terrain Tiles (AWS Open Data / Tilezen; USGS·NOAA·Copernicus EU-DEM 等, 点击查看完整署名)|Terrain: Terrain Tiles (AWS Open Data / Tilezen; USGS·NOAA·Copernicus EU-DEM etc., click for full attribution)|地形: Terrain Tiles (AWS Open Data / Tilezen; USGS·NOAA·Copernicus EU-DEM 等、クリックで全帰属表示)|지형: Terrain Tiles (AWS Open Data / Tilezen; USGS·NOAA·Copernicus EU-DEM 등, 클릭하여 전체 출처)|Relief : Terrain Tiles (AWS Open Data / Tilezen ; USGS·NOAA·Copernicus EU-DEM, etc., cliquer pour l'attribution)|Gelände: Terrain Tiles (AWS Open Data / Tilezen; USGS·NOAA·Copernicus EU-DEM u. a., Klick für Quellenangaben)|Terreno: Terrain Tiles (AWS Open Data / Tilezen; USGS·NOAA·Copernicus EU-DEM, etc., clic para atribución completa)
影像:|Imagery:|画像:|영상:|Imagerie :|Bilder:|Imágenes:
仅非商业|non-commercial only|非商用のみ|비상업용 전용|non commercial|nur nichtkommerziell|solo no comercial
仅限非商业用途|non-commercial use only|非商用利用のみ|비상업적 용도 전용|usage non commercial uniquement|nur nichtkommerzielle Nutzung|solo uso no comercial
NASA Blue Marble (公有领域, 低分辨率)|NASA Blue Marble (public domain, low-res)|NASA Blue Marble（パブリックドメイン、低解像度）|NASA Blue Marble (퍼블릭 도메인, 저해상도)|NASA Blue Marble (domaine public, basse déf.)|NASA Blue Marble (gemeinfrei, niedrig aufgelöst)|NASA Blue Marble (dominio público, baja resolución)
由 NASA EOSDIS GIBS 提供|provided by NASA EOSDIS GIBS|NASA EOSDIS GIBS 提供|NASA EOSDIS GIBS 제공|fourni par NASA EOSDIS GIBS|bereitgestellt von NASA EOSDIS GIBS|proporcionado por NASA EOSDIS GIBS
点击查看完整署名 (致谢 / 许可); 条款见 ASSETS_LICENSES.md|Click for full attribution (Credits / Licenses); terms in ASSETS_LICENSES.md|クリックで全帰属表示（クレジット／ライセンス）。条件は ASSETS_LICENSES.md|클릭하여 전체 출처 (크레딧 / 라이선스); 조건은 ASSETS_LICENSES.md|Cliquer pour l'attribution (Crédits / Licences) ; conditions dans ASSETS_LICENSES.md|Klick für Quellenangaben (Credits / Lizenzen); Bedingungen in ASSETS_LICENSES.md|Clic para atribución (Créditos / Licencias); términos en ASSETS_LICENSES.md
就绪, 隐藏内置地形|ready, built-in terrain hidden|準備完了、内蔵地形を非表示|준비 완료, 내장 지형 숨김|prêt, terrain intégré masqué|bereit, eingebautes Gelände ausgeblendet|listo, terreno integrado oculto
未就绪, 显示内置地形|not ready, showing built-in terrain|未準備、内蔵地形を表示|준비 안 됨, 내장 지형 표시|pas prêt, terrain intégré affiché|nicht bereit, eingebautes Gelände sichtbar|no listo, mostrando terreno integrado
联网地景|Online scenery|オンライン地形|온라인 지형|Paysage en ligne|Online-Szenerie|Escenario en línea
APU START 无效: 先按下 APU MASTER SW|APU START has no effect: press APU MASTER SW first|APU START 無効：先に APU MASTER SW|APU START 무효: 먼저 APU MASTER SW|APU START sans effet : d'abord APU MASTER SW|APU START wirkungslos: zuerst APU MASTER SW|APU START sin efecto: primero APU MASTER SW
APU 无法起动: 无直流电 — 先接通 BAT 1 / BAT 2|APU cannot start: no DC power — turn on BAT 1 / BAT 2 first|APU 始動不可：DC 電源なし — 先に BAT 1 / BAT 2|APU 시동 불가: DC 전원 없음 — 먼저 BAT 1 / BAT 2|APU impossible : pas de courant DC — allumez BAT 1 / BAT 2|APU-Start unmöglich: kein Gleichstrom — zuerst BAT 1 / BAT 2|APU no arranca: sin corriente DC — encienda BAT 1 / BAT 2
APU 起动中… 约|APU starting… about|APU 始動中… 約|APU 시동 중… 약|APU en démarrage… environ|APU startet… etwa|APU arrancando… unos
秒后 AVAIL|s to AVAIL|秒で AVAIL|초 후 AVAIL|s avant AVAIL|s bis AVAIL|s para AVAIL
EXT PWR 已断开 (飞机移动)|EXT PWR disconnected (aircraft moving)|EXT PWR 切断（機体移動）|EXT PWR 해제 (항공기 이동)|EXT PWR débranché (avion en mouvement)|EXT PWR getrennt (Flugzeug bewegt sich)|EXT PWR desconectada (avión en movimiento)
APU AVAIL — 可接通 APU BLEED (APU 发电已自动供电)|APU AVAIL — APU BLEED can be turned on (APU generator now powering)|APU AVAIL — APU BLEED オン可（APU 発電で給電中）|APU AVAIL — APU BLEED 켜기 가능 (APU 발전 공급 중)|APU AVAIL — APU BLEED possible (génératrice APU en service)|APU AVAIL — APU BLEED möglich (APU-Generator versorgt)|APU AVAIL — puede activar APU BLEED (generador APU alimentando)
对准完成 (NAV)|aligned (NAV)|アライン完了 (NAV)|정렬 완료 (NAV)|aligné (NAV)|ausgerichtet (NAV)|alineado (NAV)
起动中 — N2 上升, 约|starting — N2 rising, about|始動中 — N2 上昇、約|시동 중 — N2 상승, 약|en démarrage — N2 monte, environ|startet — N2 steigt, etwa|arrancando — N2 subiendo, unos
秒到慢车|s to idle|秒でアイドル|초 후 아이들|s avant ralenti|s bis Leerlauf|s para ralentí
无电源 (BAT / EXT PWR / APU GEN)|No power (BAT / EXT PWR / APU GEN)|電源なし (BAT / EXT PWR / APU GEN)|전원 없음 (BAT / EXT PWR / APU GEN)|Pas d'alimentation (BAT / EXT PWR / APU GEN)|Kein Strom (BAT / EXT PWR / APU GEN)|Sin energía (BAT / EXT PWR / APU GEN)
ENG MODE 不在 IGN/START|ENG MODE not in IGN/START|ENG MODE が IGN/START でない|ENG MODE가 IGN/START 아님|ENG MODE pas sur IGN/START|ENG MODE nicht auf IGN/START|ENG MODE no está en IGN/START
ENG START 不在 GRD|ENG START not in GRD|ENG START が GRD でない|ENG START가 GRD 아님|ENG START pas sur GRD|ENG START nicht auf GRD|ENG START no está en GRD
无引气 (APU BLEED ON, X BLEED AUTO)|No bleed air (APU BLEED ON, X BLEED AUTO)|ブリードなし (APU BLEED ON, X BLEED AUTO)|블리드 없음 (APU BLEED ON, X BLEED AUTO)|Pas de prélèvement (APU BLEED ON, X BLEED AUTO)|Keine Zapfluft (APU BLEED ON, X BLEED AUTO)|Sin sangrado (APU BLEED ON, X BLEED AUTO)
燃油泵未接通 / 无交流电|Fuel pumps off / no AC power|燃料ポンプオフ／AC 電源なし|연료 펌프 꺼짐 / AC 전원 없음|Pompes coupées / pas de courant AC|Kraftstoffpumpen aus / kein Wechselstrom|Bombas apagadas / sin AC
起动等待:|start waiting:|始動待機:|시동 대기:|démarrage en attente :|Start wartet:|arranque en espera:
已稳定在慢车 (AVAIL)|stable at idle (AVAIL)|アイドルで安定 (AVAIL)|아이들 안정 (AVAIL)|stabilisé au ralenti (AVAIL)|stabil im Leerlauf (AVAIL)|estable en ralentí (AVAIL)
网页版民航客机飞行模拟器 · 作者 kevinyuzekai ·|Web airliner flight simulator · by kevinyuzekai ·|Web 版旅客機フライトシミュレーター · 作者 kevinyuzekai ·|웹 여객기 비행 시뮬레이터 · 제작 kevinyuzekai ·|Simulateur de vol de ligne web · par kevinyuzekai ·|Web-Verkehrsflugzeug-Simulator · von kevinyuzekai ·|Simulador web de aviones comerciales · por kevinyuzekai ·
仅供娱乐，与任何航空公司、飞机制造商或其他飞行模拟软件无关；标志与图标为项目作者拥有的原创作品。|For entertainment only; not affiliated with any airline, aircraft manufacturer or other flight simulator. The logo and icon are original works owned by the author.|娯楽目的のみ。航空会社・機体メーカー・他のフライトシミュレーターとは無関係です。ロゴとアイコンは作者のオリジナル作品です。|오락용으로만 제공되며 항공사, 항공기 제조사, 다른 비행 시뮬레이터와 무관합니다. 로고와 아이콘은 제작자의 창작물입니다.|Pour le divertissement uniquement ; sans lien avec une compagnie, un constructeur ou un autre simulateur. Le logo et l'icône sont des œuvres originales de l'auteur.|Nur zur Unterhaltung; keine Verbindung zu Airlines, Herstellern oder anderen Simulatoren. Logo und Icon sind Originalwerke des Autors.|Solo para entretenimiento; sin relación con aerolíneas, fabricantes u otros simuladores. El logotipo y el icono son obras originales del autor.
真实 3D 机型模型|Real 3D aircraft models|実機 3D モデル|실제 3D 항공기 모델|Modèles 3D réels|Echte 3D-Flugzeugmodelle|Modelos 3D reales
未载入任何外部模型，全部机型使用程序化模型。|No external models loaded; all aircraft use procedural models.|外部モデルは未読み込み。全機種がプロシージャルモデルです。|외부 모델이 없으며 모든 기종이 절차적 모델입니다.|Aucun modèle externe ; tous les avions sont procéduraux.|Keine externen Modelle; alle Flugzeuge prozedural.|Sin modelos externos; todos los aviones son procedurales.
机型|Aircraft|機種|기종|Avion|Flugzeug|Avión
源模型|Source model|元モデル|원본 모델|Modèle source|Quellmodell|Modelo fuente
作者|Author|作者|제작자|Auteur|Autor|Autor
许可证|License|ライセンス|라이선스|Licence|Lizenz|Licencia
说明|Notes|説明|설명|Notes|Hinweise|Notas
派生：在源模型基础上插入机身段 (|Derived: fuselage plugs inserted into the source model (|派生：元モデルに胴体延長部を挿入 (|파생: 원본 모델에 동체 구간 삽입 (|Dérivé : tronçons de fuselage insérés (|Abgeleitet: Rumpfsegmente eingefügt (|Derivado: tramos de fuselaje insertados (
前|front|前|앞|avant|vorn|delantero
m / 后|m / rear|m / 後|m / 뒤|m / arrière|m / hinten|m / trasero
) 以匹配本机型长度，并非该机型的独立模型|) to match this type's length; not a standalone model of this type|) で全長を合わせたもの。独立したモデルではありません|) 하여 길이를 맞춤; 독립 모델 아님|) pour la longueur ; pas un modèle propre|) zur Längenanpassung; kein eigenständiges Modell|) para igualar la longitud; no es un modelo propio
经 Objaverse 数据集获取；去除起落架 (游戏使用程序化起落架)、网格简化、按本机型尺寸缩放、自绘舷窗 / 舱门 / 风挡|Obtained via the Objaverse dataset; landing gear removed (game uses procedural gear), mesh simplified, scaled to this type, windows / doors / windshield redrawn|Objaverse データセットから取得。ギア除去（ゲームはプロシージャルギア）、メッシュ簡略化、寸法に合わせ拡縮、窓／ドア／風防を描画|Objaverse 데이터셋에서 획득; 기어 제거 (게임은 절차적 기어), 메시 단순화, 크기 조정, 창 / 문 / 윈드실드 직접 그림|Obtenu via Objaverse ; train retiré (train procédural), maillage simplifié, mis à l'échelle, hublots / portes / pare-brise redessinés|Über Objaverse bezogen; Fahrwerk entfernt (prozedurales Fahrwerk), Netz vereinfacht, skaliert, Fenster / Türen / Scheibe neu gezeichnet|Obtenido de Objaverse; tren eliminado (tren procedural), malla simplificada, escalado, ventanillas / puertas / parabrisas redibujados
按本机型尺寸缩放|scaled to this type|機種寸法に合わせ拡縮|기종 크기에 맞게 조정|mis à l'échelle|auf diesen Typ skaliert|escalado a este tipo
涂装已重绘为无商标的中性白色|livery repainted neutral white without trademarks|塗装は商標なしの中立的な白に再描画|도장은 상표 없는 중립 흰색으로 다시 칠함|livrée repeinte en blanc neutre sans marque|Lackierung neutral weiß ohne Marken|librea repintada en blanco neutro sin marcas
三角面。|triangles.|ポリゴン。|삼각형.|triangles.|Dreiecke.|triángulos.
三角面|triangles|ポリゴン|삼각형|triangles|Dreiecke|triángulos
以下机型暂未找到许可证可再分发的真实模型，继续使用游戏内程序化生成的模型：|No redistributable real models found yet for these aircraft; they use in-game procedural models:|以下の機種は再配布可能な実機モデルが見つからないため、プロシージャルモデルを使用：|다음 기종은 재배포 가능한 실제 모델이 없어 절차적 모델 사용:|Aucun modèle réel redistribuable pour ces avions ; modèles procéduraux :|Für diese Flugzeuge noch keine weitergebbaren Modelle; prozedurale Modelle:|Sin modelos reales redistribuibles para estos aviones; usan modelos procedurales:
联网地景数据 (beta 0.3, 仅在开启"联网地景"时在线加载)|Online scenery data (beta 0.3, loaded only when "Online Scenery" is on)|オンライン地形データ（beta 0.3、「オンライン地形」オン時のみ）|온라인 지형 데이터 (beta 0.3, "온라인 지형" 켤 때만)|Données de paysage en ligne (beta 0.3, seulement si « Paysage en ligne » est activé)|Online-Szeneriedaten (beta 0.3, nur bei aktiver „Online-Szenerie“)|Datos de escenario en línea (beta 0.3, solo con "Escenario en línea" activado)
数据|Data|データ|데이터|Données|Daten|Datos
来源|Source|出典|출처|Source|Quelle|Fuente
许可 / 条款|License / terms|ライセンス／条件|라이선스 / 조건|Licence / conditions|Lizenz / Bedingungen|Licencia / términos
高程 (DEM)|Elevation (DEM)|標高 (DEM)|고도 (DEM)|Relief (MNT)|Höhe (DEM)|Elevación (MDE)
Terrain Tiles on AWS (Terrarium 格式, Mapzen / Tilezen)|Terrain Tiles on AWS (Terrarium format, Mapzen / Tilezen)|Terrain Tiles on AWS (Terrarium 形式, Mapzen / Tilezen)|Terrain Tiles on AWS (Terrarium 형식, Mapzen / Tilezen)|Terrain Tiles on AWS (format Terrarium, Mapzen / Tilezen)|Terrain Tiles on AWS (Terrarium-Format, Mapzen / Tilezen)|Terrain Tiles on AWS (formato Terrarium, Mapzen / Tilezen)
各数据源许可, 需署名 (见下)|Per-source licenses, attribution required (see below)|各データ源のライセンス、帰属表示必須（下記）|데이터별 라이선스, 출처 표기 필요 (아래)|Licences par source, attribution requise (voir ci-dessous)|Lizenzen je Quelle, Namensnennung nötig (siehe unten)|Licencias por fuente, atribución obligatoria (ver abajo)
卫星影像 (默认)|Satellite imagery (default)|衛星画像（既定）|위성 영상 (기본)|Imagerie satellite (par défaut)|Satellitenbilder (Standard)|Imágenes satelitales (predeterminadas)
卫星影像 (可选)|Satellite imagery (optional)|衛星画像（任意）|위성 영상 (선택)|Imagerie satellite (option)|Satellitenbilder (optional)|Imágenes satelitales (opcional)
— 仅限非商业用途|— non-commercial use only|— 非商用のみ|— 비상업적 용도 전용|— usage non commercial uniquement|— nur nichtkommerziell|— solo uso no comercial
NASA 数据, 无使用限制, 请注明来源|NASA data, no use restrictions, please credit the source|NASA データ、利用制限なし、出典を明記|NASA 데이터, 사용 제한 없음, 출처 표기|Données NASA, sans restriction, citer la source|NASA-Daten, keine Einschränkungen, Quelle angeben|Datos de la NASA, sin restricciones, cite la fuente
高程数据必须署名 (tilezen/joerd attribution.md 原文):|Elevation data requires attribution (verbatim from tilezen/joerd attribution.md):|標高データは帰属表示が必要（tilezen/joerd attribution.md 原文）:|고도 데이터는 출처 표기 필요 (tilezen/joerd attribution.md 원문):|Les données de relief exigent une attribution (texte de tilezen/joerd attribution.md) :|Höhendaten erfordern Namensnennung (Original aus tilezen/joerd attribution.md):|Los datos de elevación requieren atribución (texto de tilezen/joerd attribution.md):
瓦片请求有并发与速率限制, 并利用浏览器缓存; 关闭"联网地景"或离线时自动使用内置程序化地形, 游戏完全可离线运行。|Tile requests are rate-limited and cached by the browser; with "Online Scenery" off or offline, built-in procedural terrain is used and the game runs fully offline.|タイル要求は同時数と頻度を制限しブラウザキャッシュを利用。「オンライン地形」オフやオフライン時は内蔵地形で完全オフライン動作。|타일 요청은 동시성과 속도가 제한되며 브라우저 캐시를 사용합니다. "온라인 지형"을 끄거나 오프라인이면 내장 지형으로 완전 오프라인 실행.|Requêtes de tuiles limitées et mises en cache ; sans « Paysage en ligne » ou hors ligne, le terrain intégré est utilisé et le jeu fonctionne hors ligne.|Kachelanfragen sind begrenzt und werden gecacht; ohne „Online-Szenerie“ oder offline wird eingebautes Gelände genutzt, das Spiel läuft komplett offline.|Las peticiones de teselas están limitadas y en caché; sin "Escenario en línea" o sin conexión se usa terreno integrado y el juego funciona sin conexión.
第三方代码|Third-party code|サードパーティコード|서드파티 코드|Code tiers|Drittanbieter-Code|Código de terceros
立体机场 (beta 0.4)|3D airports (beta 0.4)|立体空港 (beta 0.4)|입체 공항 (beta 0.4)|Aéroports 3D (beta 0.4)|3D-Flughäfen (beta 0.4)|Aeropuertos 3D (beta 0.4)
座机场|airports|空港|공항|aéroports|Flughäfen|aeropuertos
内置机场|Built-in airports|内蔵空港|내장 공항|Aéroports intégrés|Eingebaute Flughäfen|Aeropuertos integrados
的航站楼轮廓、停机坪、滑行道、廊桥与塔台位置来自|: terminal outlines, aprons, taxiways, jet bridges and tower positions come from|のターミナル形状・エプロン・誘導路・搭乗橋・管制塔位置は以下から|의 터미널 윤곽, 계류장, 유도로, 탑승교, 관제탑 위치 출처|: contours des terminaux, aires, voies de circulation, passerelles et tours issus de|: Terminalumrisse, Vorfelder, Rollwege, Fluggastbrücken und Tower aus|: contornos de terminales, plataformas, calles de rodaje, pasarelas y torres de
数据（© OpenStreetMap contributors），按|data (© OpenStreetMap contributors), used under|データ（© OpenStreetMap contributors）、以下に基づき利用|데이터 (© OpenStreetMap contributors), 다음에 따라 사용|(© OpenStreetMap contributors), utilisées sous|-Daten (© OpenStreetMap contributors), genutzt unter|(© OpenStreetMap contributors), usados bajo
使用；内置的衍生数据库 js/airport-osm-data.js 同样以 ODbL 1.0 提供。|; the derived database js/airport-osm-data.js is likewise provided under ODbL 1.0.|。派生データベース js/airport-osm-data.js も ODbL 1.0 で提供。|; 파생 데이터베이스 js/airport-osm-data.js도 ODbL 1.0으로 제공.|; la base dérivée js/airport-osm-data.js est aussi sous ODbL 1.0.|; die abgeleitete Datenbank js/airport-osm-data.js ebenfalls unter ODbL 1.0.|; la base derivada js/airport-osm-data.js también se ofrece bajo ODbL 1.0.
建筑高度与外观为程序化估算（OSM 有层数 / 高度标签时按标签），不是真实建筑模型。没有 OSM 数据的机场使用手工布局或按跑道自动生成的通用航站区。|Building heights and looks are procedural estimates (using OSM level / height tags when present), not real building models. Airports without OSM data use hand-made layouts or a generic terminal area generated from the runways.|建物の高さと外観はプロシージャル推定（OSM の階数／高さタグがあれば使用）で、実際の建物モデルではありません。OSM データのない空港は手作業配置または滑走路から自動生成した汎用ターミナルを使用。|건물 높이와 외관은 절차적 추정 (OSM 층수 / 높이 태그가 있으면 사용)이며 실제 건물 모델이 아닙니다. OSM 데이터가 없는 공항은 수작업 배치 또는 활주로 기반 자동 생성 터미널을 사용.|Hauteurs et aspect des bâtiments estimés de façon procédurale (balises OSM si présentes), pas des modèles réels. Les aéroports sans données OSM utilisent une disposition manuelle ou générique.|Gebäudehöhen und -aussehen sind prozedural geschätzt (OSM-Tags wenn vorhanden), keine echten Modelle. Flughäfen ohne OSM-Daten nutzen manuelle oder generische Layouts.|Las alturas y el aspecto de los edificios son estimaciones procedurales (etiquetas OSM si existen), no modelos reales. Los aeropuertos sin datos OSM usan diseños manuales o genéricos.
所有模型均以 JavaScript 形式内嵌在 models/ 目录中，无需联网，可直接用 file:// 打开。|All models are embedded as JavaScript in models/ — no internet needed, works from file://.|全モデルは models/ に JavaScript として内蔵され、接続不要で file:// から開けます。|모든 모델은 models/에 JavaScript로 내장되어 인터넷 없이 file://로 열 수 있습니다.|Tous les modèles sont intégrés en JavaScript dans models/ — sans Internet, fonctionne en file://.|Alle Modelle sind als JavaScript in models/ eingebettet — ohne Internet, läuft über file://.|Todos los modelos están incrustados como JavaScript en models/, sin internet, funciona con file://.
模型的修改内容 (坐标转换、缩放、机身加长、涂装重绘等) 详见 ASSETS_LICENSES.md。|Model modifications (coordinate conversion, scaling, stretches, repaints, etc.) are listed in ASSETS_LICENSES.md.|モデルの変更内容（座標変換、拡縮、胴体延長、再塗装など）は ASSETS_LICENSES.md を参照。|모델 수정 내용 (좌표 변환, 크기 조정, 동체 연장, 재도장 등)은 ASSETS_LICENSES.md 참조.|Les modifications (conversion, échelle, allongement, peinture, etc.) sont détaillées dans ASSETS_LICENSES.md.|Modelländerungen (Koordinaten, Skalierung, Verlängerung, Lackierung usw.) siehe ASSETS_LICENSES.md.|Las modificaciones (conversión, escala, alargamiento, repintado, etc.) están en ASSETS_LICENSES.md.
涂装菜单中的配色方案均为通用名称，不模仿任何真实航空公司，不包含标志或商标；空中交通的呼号均为虚构。|Livery schemes use generic names, imitate no real airline and contain no logos or trademarks; air traffic callsigns are fictional.|塗装メニューの配色は汎用名で、実在の航空会社を模倣せずロゴや商標を含みません。航空交通のコールサインは架空です。|도장 메뉴의 배색은 일반 명칭이며 실제 항공사를 모방하지 않고 로고나 상표가 없습니다. 항공 교통 호출부호는 가상입니다.|Les livrées portent des noms génériques, n'imitent aucune compagnie et n'ont ni logo ni marque ; les indicatifs sont fictifs.|Lackierungen tragen generische Namen, ahmen keine Airline nach und enthalten keine Logos; Rufzeichen sind fiktiv.|Las libreas tienen nombres genéricos, no imitan aerolíneas y no llevan logotipos; los indicativos son ficticios.
循环切换视角（驾驶舱 / 追踪 / 自由 …），也可点顶栏 🎥 视角按钮|@|視点を順に切替（コックピット／追跡／フリー …）、上部バーの 🎥 ボタンでも可|시점 순환 (조종석 / 추적 / 자유 …), 상단 바 🎥 버튼도 가능|Faire défiler les vues (cockpit / poursuite / libre …) ou bouton 🎥 en haut|Ansichten durchschalten (Cockpit / Verfolger / frei …) oder 🎥 oben|Alternar vistas (cabina / persecución / libre …) o botón 🎥 arriba
环视（鼠标驾驶杆开启时用右键拖拽）；外部视角滚轮缩放|@|見回し（マウス操縦桿オン時は右ドラッグ）、外部視点はホイールでズーム|둘러보기 (마우스 조종간 켜짐 시 오른쪽 드래그); 외부 시점 휠 확대/축소|Regarder autour (clic droit si manche souris actif) ; molette = zoom en vue extérieure|Umsehen (mit Maussteuerung Rechtsziehen); Rad zoomt in Außenansichten|Mirar alrededor (clic derecho con palanca de ratón); rueda = zoom en vistas externas
单指拖动 = 驾驶杆，第二根手指拖动 = 环视|@|1本指ドラッグ＝操縦桿、2本目の指＝見回し|한 손가락 드래그 = 조종간, 두 번째 손가락 = 둘러보기|Un doigt = manche, deuxième doigt = regarder autour|Ein Finger = Steuer, zweiter Finger = Umsehen|Un dedo = palanca, segundo dedo = mirar alrededor
默认三维驾驶舱（机长座位）；拖拽鼠标 / 摇杆苦力帽环视，|@|既定は3Dコックピット（機長席）。マウスドラッグ／ハットスイッチで見回し、|기본 3D 조종석 (기장석); 마우스 드래그 / 햇 스위치로 둘러보기,|Cockpit 3D par défaut (place commandant) ; regarder avec la souris / le chapeau chinois,|Standard-3D-Cockpit (Kapitänssitz); Umsehen mit Maus / Coolie-Hat,|Cabina 3D por defecto (asiento del comandante); mire con el ratón / la seta,
视线回正|recenters view|視線を正面に戻す|시점 정면 복귀|recentre la vue|Blick zentrieren|centra la vista
看向仪表板（低头 + 放大，仪表清晰可读）/ 恢复向外看，也可点顶栏 🔍 仪表板|@|計器盤を見る（下向き＋ズームで判読可）／外を見る、上部バーの 🔍 でも可|계기판 보기 (아래 + 확대로 판독 가능) / 밖 보기, 상단 🔍도 가능|Regarder le tableau (bas + zoom, lisible) / l'extérieur ; ou 🔍 en haut|Instrumente ansehen (runter + Zoom) / nach draußen; oder 🔍 oben|Mirar el panel (abajo + zoom, legible) / el exterior; o 🔍 arriba
左键 = 正向 / 接通 / 放出；右键或 Shift+左键 = 反向 / 断开 / 收起；旋钮、油门、襟翼、减速板可用滚轮或拖动|@|左クリック＝正方向／オン／展開、右クリックまたは Shift+左＝逆／オフ／格納。ノブ・スロットル・フラップ・スピードブレーキはホイールかドラッグ|왼쪽 = 정방향 / 켜기 / 전개; 오른쪽 또는 Shift+왼쪽 = 역방향 / 끄기 / 수납; 노브, 스로틀, 플랩, 스피드 브레이크는 휠 또는 드래그|Clic gauche = avant / on / sortir ; clic droit ou Maj+gauche = arrière / off / rentrer ; boutons, manettes, volets et aérofreins à la molette ou en glissant|Linksklick = vor / ein / aus­fahren; Rechtsklick oder Umschalt+Links = zurück / aus / einfahren; Knöpfe, Schub, Klappen und Bremsklappen per Rad oder Ziehen|Clic izq. = adelante / on / extender; clic der. o Mayús+izq. = atrás / off / retraer; perillas, aceleradores, flaps y aerofrenos con rueda o arrastre
遮光板按钮可点；旋钮左 / 右半边 = 减 / 加（可按住或滚轮），上半 = PUSH，下半 = PULL；点击起落架手柄收放|@|グレアシールドのボタンはクリック可。ノブ左／右半分＝減／増（長押しかホイール）、上半分＝PUSH、下半分＝PULL。ギアレバーをクリックで上げ下げ|글레어실드 버튼 클릭 가능; 노브 왼쪽 / 오른쪽 절반 = 감소 / 증가 (누르기 또는 휠), 위 = PUSH, 아래 = PULL; 기어 레버 클릭으로 올림/내림|Boutons de l'auvent cliquables ; moitié gauche / droite du bouton = − / + (maintenir ou molette), haut = PUSH, bas = PULL ; clic sur le levier de train|Glareshield-Tasten klickbar; Knopf linke / rechte Hälfte = − / + (halten oder Rad), oben = PUSH, unten = PULL; Fahrwerkshebel anklicken|Botones del glareshield pulsables; mitad izq. / der. de la perilla = − / + (mantener o rueda), arriba = PUSH, abajo = PULL; clic en la palanca del tren
左摇杆 = 杆，LB/RB = 方向舵，LT/RT = 油门，A 起落架，X 刹车，Y 视角，十字键 襟翼|@|左スティック＝操縦桿、LB/RB＝ラダー、LT/RT＝スロットル、A ギア、X ブレーキ、Y 視点、十字キー フラップ|왼쪽 스틱 = 조종간, LB/RB = 방향타, LT/RT = 스로틀, A 기어, X 브레이크, Y 시점, 십자키 플랩|Stick gauche = manche, LB/RB = direction, LT/RT = manettes, A train, X freins, Y vue, croix = volets|Linker Stick = Steuer, LB/RB = Seitenruder, LT/RT = Schub, A Fahrwerk, X Bremsen, Y Ansicht, Steuerkreuz = Klappen|Stick izq. = palanca, LB/RB = timón, LT/RT = aceleradores, A tren, X frenos, Y vista, cruceta = flaps
顶栏 🕹 摇杆 或 菜单"摇杆设置"中映射轴与按钮（AP 断开 / PTT / 刹车）；Chrome/Edge 需先按一下摇杆按钮|@|上部バーの 🕹 またはメニュー「ジョイスティック設定」で軸とボタン（AP 解除／PTT／ブレーキ）を割り当て。Chrome/Edge では先にボタンを押す|상단 🕹 또는 메뉴 "조이스틱 설정"에서 축과 버튼 (AP 해제 / PTT / 브레이크) 매핑; Chrome/Edge는 먼저 버튼을 누르세요|Affectez axes et boutons (déconnexion PA / PTT / freins) via 🕹 en haut ou « Réglages joystick » ; Chrome/Edge : appuyez d'abord sur un bouton|Achsen und Tasten (AP trennen / PTT / Bremsen) über 🕹 oben oder „Joystick-Einstellungen“ belegen; Chrome/Edge: zuerst eine Taste drücken|Asigne ejes y botones (desconexión AP / PTT / frenos) con 🕹 arriba o "Ajustes de joystick"; Chrome/Edge: pulse antes un botón
自动识别为脚舵：踏板 = 方向舵，左/右趾刹 = 刹车，不会占用俯仰/横滚；与摇杆同时连接时方向舵以脚舵为准|@|ペダルとして自動認識：ペダル＝ラダー、左右トーブレーキ＝ブレーキ、ピッチ／ロールには使わない。スティック併用時はラダーはペダル優先|페달로 자동 인식: 페달 = 방향타, 좌/우 토 브레이크 = 브레이크, 피치/롤 미사용; 스틱과 함께 연결 시 방향타는 페달 우선|Détectés comme palonniers : pédales = direction, freins gauche/droit = freins, jamais tangage/roulis ; avec un manche, la direction suit les palonniers|Als Pedale erkannt: Pedale = Seitenruder, Zehenbremsen = Bremsen, nie Nicken/Rollen; mit Stick haben die Pedale Vorrang beim Seitenruder|Detectados como pedales: pedales = timón, frenos izq./der. = frenos, nunca cabeceo/alabeo; con palanca, el timón sigue a los pedales
襟翼放至起飞位（F/V 键或点击操纵台），推油门至 TOGA，达到 VR 后轻拉杆， 正上升率后收起落架，按速度收襟翼。|@|離陸フラップ（F/V キーかペデスタル）、TOGA まで推力、VR で軽く引き、正の上昇率でギア上げ、速度に応じフラップ格納。|이륙 플랩 설정 (F/V 키 또는 페데스탈), TOGA까지 추력, VR에서 살짝 당기고, 양의 상승률 후 기어 올림, 속도에 따라 플랩 수납.|Volets décollage (F/V ou pylône), poussée TOGA, rotation douce à VR, train rentré en montée positive, volets rentrés selon la vitesse.|Startklappen (F/V oder Pedestal), Schub auf TOGA, bei VR sanft ziehen, bei positiver Steigrate Fahrwerk ein, Klappen nach Fahrt einfahren.|Flaps de despegue (F/V o pedestal), empuje TOGA, rote suave en VR, tren arriba con ascenso positivo y flaps según velocidad.
保持目标速度约 250 kt 至 10000 ft，之后加速到 300 kt / M0.78。|@|10000 ft まで約 250 kt を保持し、その後 300 kt / M0.78 へ加速。|10000 ft까지 약 250 kt 유지 후 300 kt / M0.78로 가속.|Environ 250 kt jusqu'à 10 000 ft, puis 300 kt / M0.78.|Etwa 250 kt bis 10.000 ft, dann 300 kt / M0.78.|Unos 250 kt hasta 10 000 ft y luego 300 kt / M0.78.
接通 AP 与 A/THR，使用 ALT 保持高度、MACH 保持马赫数。|@|AP と A/THR を作動、ALT で高度保持、MACH でマッハ保持。|AP와 A/THR 연결, ALT로 고도 유지, MACH로 마하 유지.|Engagez PA et A/THR ; ALT pour l'altitude, MACH pour le Mach.|AP und A/THR aktivieren; ALT hält Höhe, MACH hält Mach.|Active AP y A/THR; ALT mantiene altitud y MACH el Mach.
下降率不超过 2000 fpm，提前 3 nm/1000 ft 开始下高。|@|降下率は 2000 fpm 以下、1000 ft あたり 3 nm 手前で降下開始。|강하율 2000 fpm 이하, 1000 ft당 3 nm 전에 강하 시작.|Descente sous 2000 fpm ; commencez 3 NM par 1000 ft avant.|Sinkrate unter 2000 fpm; 3 NM pro 1000 ft vorher beginnen.|Descenso menor de 2000 fpm; empiece 3 NM por cada 1000 ft antes.
设定 ILS 频率，APPR 预位，截获 LOC 与 G/S 后放起落架与着陆襟翼， 自动刹车选择 LO 或 2。|@|ILS 周波数を設定、APPR アーム、LOC と G/S 捕捉後にギアと着陸フラップ、オートブレーキは LO か 2。|ILS 주파수 설정, APPR 준비, LOC와 G/S 포착 후 기어와 착륙 플랩, 오토브레이크 LO 또는 2.|Réglez la fréquence ILS, armez APPR ; après capture LOC et G/S, train et volets atterrissage, autofreinage LO ou 2.|ILS-Frequenz setzen, APPR scharf; nach LOC/G/S Fahrwerk und Landeklappen, Autobremse LO oder 2.|Fije la frecuencia ILS, arme APPR; tras LOC y G/S, tren y flaps de aterrizaje, autofreno LO o 2.
50 ft 开始收油门，20 ft 柔和拉平，接地后拉反推并使用方向舵保持中心线。|@|50 ft で推力を絞り、20 ft で穏やかにフレア、接地後はリバーサーとラダーで中心線を保持。|50 ft에서 추력 감소, 20 ft에서 부드럽게 플레어, 접지 후 역추진과 방향타로 중심선 유지.|Réduisez à 50 ft, arrondi doux à 20 ft, puis inverseurs et direction pour tenir l'axe.|Bei 50 ft Schub raus, bei 20 ft sanft abfangen, danach Umkehrschub und Seitenruder für die Mittellinie.|Reduzca a 50 ft, enderece suave a 20 ft y use reversas y timón para el eje.
主菜单「飞行场景」选「冷舱启动」；其他场景开局时所有开关已在运行位置。全部步骤都可用鼠标点击三维驾驶舱完成（左键正向 / 右键反向 / 滚轮），ECAM 下方青色 ▶ 行提示下一步。|@|メインメニューの「シナリオ」で「コールド＆ダーク」を選択。他のシナリオは全スイッチが作動位置で開始。全手順を3Dコックピットのクリックで実行でき（左＝正／右＝逆／ホイール）、下部 ECAM の水色 ▶ 行が次の手順。|메인 메뉴 "시나리오"에서 "콜드 앤 다크" 선택; 다른 시나리오는 모든 스위치가 작동 위치에서 시작. 모든 단계는 3D 조종석 클릭으로 가능 (왼쪽 정방향 / 오른쪽 역방향 / 휠), 하단 ECAM 청록색 ▶ 줄이 다음 단계.|Choisissez « Démarrage à froid » dans Scénario ; les autres scénarios démarrent interrupteurs en place. Tout se fait en cliquant le cockpit 3D (gauche / droite / molette) ; la ligne cyan ▶ de l'ECAM inférieur indique l'étape suivante.|Im Menü unter Szenario „Kaltstart“ wählen; andere Szenarien starten mit gesetzten Schaltern. Alles per Klick im 3D-Cockpit (links / rechts / Rad); die cyanfarbene ▶-Zeile im unteren ECAM zeigt den nächsten Schritt.|Elija "Arranque en frío" en Escenario; los demás empiezan con todo encendido. Todo se hace pulsando la cabina 3D (izq. / der. / rueda); la línea cian ▶ del ECAM inferior indica el siguiente paso.
头顶板 ELEC — BAT 1 + BAT 2 ON（OFF 灯熄灭），EXT PWR ON（AVAIL → ON），显示器通电。|@|オーバーヘッド ELEC — BAT 1 + BAT 2 ON（OFF 灯消灯）、EXT PWR ON（AVAIL → ON）、ディスプレイ通電。|오버헤드 ELEC — BAT 1 + BAT 2 ON (OFF 등 소등), EXT PWR ON (AVAIL → ON), 디스플레이 전원.|Panneau ELEC — BAT 1 + BAT 2 ON (voyants OFF éteints), EXT PWR ON (AVAIL → ON), écrans allumés.|Overhead ELEC — BAT 1 + BAT 2 ON (OFF-Lampen aus), EXT PWR ON (AVAIL → ON), Displays an.|Panel ELEC — BAT 1 + BAT 2 ON (luces OFF apagadas), EXT PWR ON (AVAIL → ON), pantallas encendidas.
IR 1/2/3 旋到 NAV（对准约 75 秒，PFD/ND 显示 ALIGN，对准完成后才有姿态、地图与自动驾驶）。|@|IR 1/2/3 を NAV に（アライン約75秒、PFD/ND に ALIGN、完了後に姿勢・地図・AP が使用可）。|IR 1/2/3을 NAV로 (정렬 약 75초, PFD/ND에 ALIGN, 완료 후 자세·지도·AP 사용).|IR 1/2/3 sur NAV (alignement ~75 s, ALIGN sur PFD/ND ; assiette, carte et PA ensuite).|IR 1/2/3 auf NAV (Ausrichtung ~75 s, ALIGN auf PFD/ND; danach Fluglage, Karte, AP).|IR 1/2/3 a NAV (alineación ~75 s, ALIGN en PFD/ND; luego actitud, mapa y AP).
FUEL 6 个泵 ON；EXT LT 打开 BEACON 与 NAV；SIGNS 安全带 ON。|@|FUEL ポンプ6基 ON、EXT LT の BEACON と NAV オン、SIGNS シートベルト ON。|FUEL 펌프 6개 ON; EXT LT BEACON과 NAV 켜기; SIGNS 안전벨트 ON.|6 pompes FUEL ON ; EXT LT BEACON et NAV ; SIGNS ceintures ON.|6 FUEL-Pumpen ON; EXT LT BEACON und NAV; SIGNS Anschnallzeichen ON.|6 bombas FUEL ON; EXT LT BEACON y NAV; SIGNS cinturones ON.
MASTER SW → START，约 30 秒后 AVAIL；AIR COND 面板 APU BLEED ON（X BLEED 保持 AUTO）。|@|MASTER SW → START、約30秒で AVAIL。AIR COND パネルの APU BLEED ON（X BLEED は AUTO）。|MASTER SW → START, 약 30초 후 AVAIL; AIR COND 패널 APU BLEED ON (X BLEED는 AUTO).|MASTER SW → START, AVAIL après ~30 s ; panneau AIR COND : APU BLEED ON (X BLEED sur AUTO).|MASTER SW → START, nach ~30 s AVAIL; AIR COND: APU BLEED ON (X BLEED auf AUTO).|MASTER SW → START, AVAIL tras ~30 s; panel AIR COND: APU BLEED ON (X BLEED en AUTO).
操纵台 ENG MODE 旋到 IGN START → ENG MASTER 2 ON，等慢车后 ENG MASTER 1 ON（每台约 40 秒）。|@|ペデスタルの ENG MODE を IGN START → ENG MASTER 2 ON、アイドル後 ENG MASTER 1 ON（各約40秒）。|페데스탈 ENG MODE를 IGN START로 → ENG MASTER 2 ON, 아이들 후 ENG MASTER 1 ON (각 약 40초).|ENG MODE sur IGN START → ENG MASTER 2 ON, puis au ralenti ENG MASTER 1 ON (~40 s chacun).|ENG MODE auf IGN START → ENG MASTER 2 ON, nach Leerlauf ENG MASTER 1 ON (je ~40 s).|ENG MODE a IGN START → ENG MASTER 2 ON y, en ralentí, ENG MASTER 1 ON (~40 s cada uno).
ENG MODE 回 NORM，APU BLEED OFF，PACK 1/2 ON，襟翼起飞位，松开停留刹车滑行。|@|ENG MODE を NORM、APU BLEED OFF、PACK 1/2 ON、離陸フラップ、パーキングブレーキを解除してタキシング。|ENG MODE를 NORM으로, APU BLEED OFF, PACK 1/2 ON, 이륙 플랩, 주차 브레이크 해제 후 지상 활주.|ENG MODE sur NORM, APU BLEED OFF, PACK 1/2 ON, volets décollage, frein relâché, roulage.|ENG MODE auf NORM, APU BLEED OFF, PACK 1/2 ON, Startklappen, Parkbremse lösen und rollen.|ENG MODE a NORM, APU BLEED OFF, PACK 1/2 ON, flaps de despegue, suelte el freno y ruede.
（737 / 737 MAX / 777 / 787 / E190）：BATTERY + STBY PWR，GRD PWR，IRS L/R → NAV，燃油泵，APU + START，APU BLEED，ENGINE START 旋到 GRD，FUEL CONTROL → RUN（起动完成后 START 自动回 OFF）。|@|（737 / 737 MAX / 777 / 787 / E190）：BATTERY + STBY PWR、GRD PWR、IRS L/R → NAV、燃料ポンプ、APU + START、APU BLEED、ENGINE START を GRD、FUEL CONTROL → RUN（始動後 START は自動で OFF）。|(737 / 737 MAX / 777 / 787 / E190): BATTERY + STBY PWR, GRD PWR, IRS L/R → NAV, 연료 펌프, APU + START, APU BLEED, ENGINE START를 GRD로, FUEL CONTROL → RUN (시동 후 START 자동 OFF).|(737 / 737 MAX / 777 / 787 / E190) : BATTERY + STBY PWR, GRD PWR, IRS L/R → NAV, pompes, APU + START, APU BLEED, ENGINE START sur GRD, FUEL CONTROL → RUN (START revient sur OFF).|(737 / 737 MAX / 777 / 787 / E190): BATTERY + STBY PWR, GRD PWR, IRS L/R → NAV, Pumpen, APU + START, APU BLEED, ENGINE START auf GRD, FUEL CONTROL → RUN (START geht automatisch auf OFF).|(737 / 737 MAX / 777 / 787 / E190): BATTERY + STBY PWR, GRD PWR, IRS L/R → NAV, bombas, APU + START, APU BLEED, ENGINE START a GRD, FUEL CONTROL → RUN (START vuelve a OFF).
本模拟器使用真实的六自由度飞行动力学模型：升力/阻力随迎角与马赫数变化、失速与过失速特性、 地面效应、跨音速阻力发散、起落架弹簧阻尼与轮胎侧偏、发动机转子滞后与高空推力衰减、 燃油消耗引起重量与重心变化。各机型的展弦比、后掠角、发动机推力均按公开数据建模。|@|本シミュレーターは6自由度の飛行力学モデルを使用：迎角とマッハ数による揚力／抗力変化、失速と失速後特性、地面効果、遷音速抗力増加、ギアのばね減衰とタイヤ横滑り、エンジンのスプール遅れと高高度での推力低下、燃料消費による重量・重心変化。各機種のアスペクト比・後退角・推力は公開データに基づきます。|이 시뮬레이터는 6자유도 비행 역학 모델을 사용합니다: 받음각과 마하에 따른 양력/항력 변화, 실속 및 실속 후 특성, 지면 효과, 천음속 항력 증가, 기어 스프링 댐핑과 타이어 슬립, 엔진 스풀 지연과 고고도 추력 감소, 연료 소모에 따른 중량·무게중심 변화. 각 기종의 가로세로비, 후퇴각, 추력은 공개 데이터 기반입니다.|Ce simulateur utilise un modèle de vol à six degrés de liberté : portance/traînée selon incidence et Mach, décrochage et après-décrochage, effet de sol, traînée transsonique, train amorti et dérive des pneus, inertie moteur et perte de poussée en altitude, masse et centrage selon le carburant. Allongement, flèche et poussée suivent des données publiques.|Dieser Simulator nutzt ein Flugmodell mit sechs Freiheitsgraden: Auftrieb/Widerstand nach Anstellwinkel und Mach, Abriss und Post-Stall, Bodeneffekt, transsonischer Widerstandsanstieg, gefedertes Fahrwerk und Reifenschlupf, Triebwerksträgheit und Schubabfall in der Höhe, Gewichts- und Schwerpunktänderung durch Verbrauch. Streckung, Pfeilung und Schub nach öffentlichen Daten.|Este simulador usa un modelo de vuelo de seis grados de libertad: sustentación/resistencia según ángulo de ataque y Mach, pérdida y postpérdida, efecto suelo, resistencia transónica, tren amortiguado y deriva de neumáticos, inercia de motores y pérdida de empuje en altura, y cambio de peso y centro de gravedad por consumo. Alargamiento, flecha y empuje según datos públicos.
支持 Thrustmaster TCA 空客侧杆、TCA 油门台 (Quadrant)、方向舵脚舵及其他 HID 飞行摇杆。 每台设备只使用与其类型相符的轴 (或你手动绑定的轴); 多台设备同时连接时, 俯仰/横滚以侧杆为准, 方向舵以脚舵为准。|@|Thrustmaster TCA エアバス サイドスティック、TCA スロットル (Quadrant)、ラダーペダル、その他 HID スティックに対応。各デバイスは種類に合う軸（または手動割り当て）のみ使用。複数接続時はピッチ／ロールはサイドスティック、ラダーはペダルが優先。|Thrustmaster TCA 에어버스 사이드스틱, TCA 쿼드런트, 러더 페달 및 기타 HID 조이스틱 지원. 각 장치는 유형에 맞는 축 (또는 수동 매핑 축)만 사용; 여러 장치 연결 시 피치/롤은 사이드스틱, 방향타는 페달 우선.|Prend en charge le mini-manche Thrustmaster TCA Airbus, le TCA Quadrant, les palonniers et autres joysticks HID. Chaque appareil n'utilise que ses axes (ou ceux affectés) ; à plusieurs, tangage/roulis suivent le mini-manche et la direction les palonniers.|Unterstützt Thrustmaster TCA Airbus-Sidestick, TCA Quadrant, Seitenruderpedale und andere HID-Sticks. Jedes Gerät nutzt nur passende (oder manuell belegte) Achsen; bei mehreren folgen Nicken/Rollen dem Sidestick, das Seitenruder den Pedalen.|Compatible con sidestick Thrustmaster TCA Airbus, TCA Quadrant, pedales y otros joysticks HID. Cada dispositivo usa solo sus ejes (o los asignados); con varios, cabeceo/alabeo siguen al sidestick y el timón a los pedales.
`;
})(typeof window !== 'undefined' ? window : this);
