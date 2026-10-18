/* 天际航线 SkyRoute — 界面多语言 (i18n)
   以中文原文为键的集中词典; 启动时及 DOM 变化时自动替换文本节点与 title/placeholder/aria-label/alt。
   语言保存在 localStorage('skyroute.lang'), 默认取 navigator.language。
   每行: 中文|English|日本語|한국어|Français|Deutsch|Español  (只写到 English 的行, 其他语言回退英文) */
(function (global) {
  'use strict';
  var FS = global.FS = global.FS || {};
  var LANGS = [['zh', '简体中文'], ['en', 'English'], ['ja', '日本語'], ['ko', '한국어'], ['fr', 'Français'], ['de', 'Deutsch'], ['es', 'Español']];
  var KEY = 'skyroute.lang';
  var RAW = String.raw`
中国|China|中国|중국|Chine|China|China
天际航线 SkyRoute|SkyRoute|SkyRoute|SkyRoute|SkyRoute|SkyRoute|SkyRoute
正在初始化…|Initializing…|初期化中…|초기화 중…|Initialisation…|Initialisierung…|Inicializando…
SKYROUTE · 民航客机飞行模拟|SKYROUTE · AIRLINER FLIGHT SIMULATOR|SKYROUTE · 旅客機フライトシミュレーター|SKYROUTE · 여객기 비행 시뮬레이터|SKYROUTE · SIMULATEUR DE VOL DE LIGNE|SKYROUTE · VERKEHRSFLUGZEUG-SIMULATOR|SKYROUTE · SIMULADOR DE AVIONES COMERCIALES
选择机型|Select Aircraft|機体選択|기종 선택|Choisir l'avion|Flugzeug wählen|Elegir avión
飞行场景|Scenario|シナリオ|시나리오|Scénario|Szenario|Escenario
飞行设置|Flight Settings|フライト設定|비행 설정|Paramètres de vol|Flugeinstellungen|Ajustes de vuelo
界面语言|Language|言語|언어|Langue|Sprache|Idioma
音效音量|Sound Volume|効果音の音量|효과음 볼륨|Volume sonore|Lautstärke|Volumen
静音|Mute|ミュート|음소거|Muet|Stumm|Silencio
检查更新|Check for Updates|アップデートを確認|업데이트 확인|Rechercher des mises à jour|Nach Updates suchen|Buscar actualizaciones
出发机场|Departure Airport|出発空港|출발 공항|Aéroport de départ|Abflughafen|Aeropuerto de salida
跑道|Runway|滑走路|활주로|Piste|Piste|Pista
目的机场|Destination Airport|到着空港|도착 공항|Aéroport d'arrivée|Zielflughafen|Aeropuerto de destino
天气|Weather|天候|날씨|Météo|Wetter|Clima
涂装|Livery|塗装|도장|Livrée|Lackierung|Librea
当地时间|Local Time|現地時刻|현지 시간|Heure locale|Ortszeit|Hora local
燃油|Fuel|燃料|연료|Carburant|Treibstoff|Combustible
业载|Payload|ペイロード|탑재량|Charge utile|Zuladung|Carga útil
联网地景|Online Scenery|オンライン地形|온라인 지형|Paysage en ligne|Online-Szenerie|Escenario en línea
在线加载真实地形高程与卫星影像 (需要联网; 离线时自动回退到内置地形)|Stream real terrain elevation and satellite imagery (requires internet; falls back to built-in terrain offline)|実際の標高と衛星画像をオンラインで読み込み（要接続、オフライン時は内蔵地形）|실제 지형 고도와 위성 영상을 온라인으로 불러오기 (인터넷 필요, 오프라인 시 내장 지형)|Charge le relief et l'imagerie satellite réels (Internet requis ; terrain intégré hors ligne)|Lädt echtes Gelände und Satellitenbilder (Internet nötig; offline eingebautes Gelände)|Carga relieve e imágenes satelitales reales (requiere internet; sin conexión usa terreno integrado)
开 (真实地形 + 卫星影像)|On (real terrain + satellite imagery)|オン（実地形＋衛星画像）|켜기 (실제 지형 + 위성 영상)|Activé (relief réel + satellite)|Ein (echtes Gelände + Satellit)|Activado (relieve real + satélite)
关 (内置程序化地形)|Off (built-in procedural terrain)|オフ（内蔵プロシージャル地形）|끄기 (내장 절차적 지형)|Désactivé (terrain procédural intégré)|Aus (eingebautes prozedurales Gelände)|Desactivado (terreno procedural integrado)
影像源|Imagery Source|画像ソース|영상 출처|Source d'imagerie|Bildquelle|Fuente de imágenes
影像许可见 致谢 / 许可|See Credits / Licenses for imagery licensing|画像のライセンスはクレジット／ライセンスを参照|영상 라이선스는 크레딧 / 라이선스 참조|Voir Crédits / Licences pour l'imagerie|Bildlizenzen siehe Credits / Lizenzen|Licencias de imágenes en Créditos / Licencias
Sentinel-2 2024 (仅非商业)|Sentinel-2 2024 (non-commercial only)|Sentinel-2 2024（非商用のみ）|Sentinel-2 2024 (비상업용 전용)|Sentinel-2 2024 (non commercial)|Sentinel-2 2024 (nur nichtkommerziell)|Sentinel-2 2024 (solo no comercial)
NASA Blue Marble (低清)|NASA Blue Marble (low-res)|NASA Blue Marble（低解像度）|NASA Blue Marble (저해상도)|NASA Blue Marble (basse déf.)|NASA Blue Marble (niedrig aufgelöst)|NASA Blue Marble (baja resolución)
时间倍率|Time Rate|時間倍率|시간 배율|Vitesse du temps|Zeitraffer|Velocidad del tiempo
×0.5 慢动作|×0.5 Slow motion|×0.5 スロー|×0.5 슬로 모션|×0.5 Ralenti|×0.5 Zeitlupe|×0.5 Cámara lenta
×1 正常|×1 Normal|×1 通常|×1 보통|×1 Normal|×1 Normal|×1 Normal
3D 模型、地景数据来源与许可|3D models, scenery data sources and licenses|3Dモデル・地形データの出典とライセンス|3D 모델, 지형 데이터 출처 및 라이선스|Modèles 3D, sources et licences des données|3D-Modelle, Szeneriedaten und Lizenzen|Modelos 3D, fuentes de datos y licencias
致谢 / 许可|Credits / Licenses|クレジット／ライセンス|크레딧 / 라이선스|Crédits / Licences|Credits / Lizenzen|Créditos / Licencias
摇杆 / 侧杆 / 油门台映射|Joystick / sidestick / throttle mapping|ジョイスティック／サイドスティック／スロットル割り当て|조이스틱 / 사이드스틱 / 스로틀 매핑|Affectation joystick / mini-manche / manettes|Joystick- / Sidestick- / Schubhebel-Belegung|Asignación de joystick / sidestick / aceleradores
摇杆设置|Joystick Settings|ジョイスティック設定|조이스틱 설정|Réglages joystick|Joystick-Einstellungen|Ajustes de joystick
快速开始（默认起飞）|Quick Start (default takeoff)|クイックスタート（標準離陸）|빠른 시작 (기본 이륙)|Démarrage rapide (décollage)|Schnellstart (Standardstart)|Inicio rápido (despegue)
开始飞行 →|Start Flight →|フライト開始 →|비행 시작 →|Commencer le vol →|Flug starten →|Empezar vuelo →
菜单 / 暂停 (Esc)|Menu / Pause (Esc)|メニュー／一時停止 (Esc)|메뉴 / 일시정지 (Esc)|Menu / Pause (Échap)|Menü / Pause (Esc)|Menú / Pausa (Esc)
切换视角 (C 键循环, Shift+C 反向)|Change view (C cycles, Shift+C reverse)|視点切替（C で順送り、Shift+C で逆）|시점 전환 (C 순환, Shift+C 역순)|Changer de vue (C, Maj+C inverse)|Ansicht wechseln (C, Umschalt+C zurück)|Cambiar vista (C, Mayús+C inversa)
驾驶舱|Cockpit|コックピット|조종석|Cockpit|Cockpit|Cabina
选择视角|Select view|視点選択|시점 선택|Choisir la vue|Ansicht wählen|Elegir vista
鼠标驾驶杆: 光标相对屏幕中心 = 杆量 (M)|Mouse yoke: cursor offset from center = stick input (M)|マウス操縦桿：画面中央からのカーソル位置＝操縦量 (M)|마우스 조종간: 화면 중앙 기준 커서 위치 = 조종량 (M)|Manche souris : décalage du curseur = commande (M)|Maussteuerung: Cursorabstand zur Mitte = Ausschlag (M)|Palanca con ratón: desplazamiento del cursor = mando (M)
🖱 鼠标杆|🖱 Mouse yoke|🖱 マウス操縦|🖱 마우스 조종|🖱 Manche souris|🖱 Maussteuerung|🖱 Ratón
摇杆设置 (Gamepad API)|Joystick settings (Gamepad API)|ジョイスティック設定 (Gamepad API)|조이스틱 설정 (Gamepad API)|Réglages joystick (Gamepad API)|Joystick-Einstellungen (Gamepad API)|Ajustes de joystick (Gamepad API)
🕹 摇杆|🕹 Joystick|🕹 ジョイスティック|🕹 조이스틱|🕹 Joystick|🕹 Joystick|🕹 Joystick
操作说明 (F1 / ?)|Help (F1 / ?)|操作説明 (F1 / ?)|조작 설명 (F1 / ?)|Aide (F1 / ?)|Hilfe (F1 / ?)|Ayuda (F1 / ?)
三维驾驶舱: 看向仪表板 / 恢复向外看 (N)|3D cockpit: look at panel / look outside (N)|3Dコックピット：計器盤を見る／外を見る (N)|3D 조종석: 계기판 보기 / 밖 보기 (N)|Cockpit 3D : regarder le tableau / l'extérieur (N)|3D-Cockpit: Instrumente / nach draußen (N)|Cabina 3D: mirar panel / exterior (N)
🔍 仪表板|🔍 Panel|🔍 計器盤|🔍 계기판|🔍 Tableau|🔍 Instrumente|🔍 Panel
显示/隐藏侧边面板: 检查单 / 中央操纵台 (Shift+Tab)|Show/hide side panels: checklist / pedestal (Shift+Tab)|サイドパネル表示切替：チェックリスト／ペデスタル (Shift+Tab)|사이드 패널 표시/숨기기: 체크리스트 / 페데스탈 (Shift+Tab)|Afficher/masquer les panneaux : check-list / pylône (Maj+Tab)|Seitenleisten ein/aus: Checkliste / Pedestal (Umschalt+Tab)|Mostrar/ocultar paneles: lista / pedestal (Mayús+Tab)
隐藏界面 (` + "`" + `)|Hide UI (` + "`" + `)|UI を隠す (` + "`" + `)|UI 숨기기 (` + "`" + `)|Masquer l'interface (` + "`" + `)|UI ausblenden (` + "`" + `)|Ocultar interfaz (` + "`" + `)
FCU · 飞行控制组件|FCU · Flight Control Unit|FCU · フライトコントロールユニット|FCU · 비행 제어 장치|FCU · Unité de contrôle de vol|FCU · Flight Control Unit|FCU · Unidad de control de vuelo
速度|Speed|速度|속도|Vitesse|Geschwindigkeit|Velocidad
航向|Heading|方位|방위|Cap|Kurs|Rumbo
高度|Altitude|高度|고도|Altitude|Höhe|Altitud
垂直速度|Vertical Speed|昇降率|수직 속도|Vitesse verticale|Steigrate|Velocidad vertical
检查单|Checklist|チェックリスト|체크리스트|Check-list|Checkliste|Lista de chequeo
中央操纵台 · PEDESTAL|PEDESTAL|ペデスタル · PEDESTAL|페데스탈 · PEDESTAL|Pylône · PEDESTAL|Mittelkonsole · PEDESTAL|Pedestal · PEDESTAL
油门|Throttle|スロットル|스로틀|Manettes|Schub|Aceleradores
慢车|Idle|アイドル|아이들|Ralenti|Leerlauf|Ralentí
爬升|Climb|上昇|상승|Montée|Steigflug|Ascenso
灵活|Flex|フレックス|플렉스|Flex|Flex|Flex
襟翼|Flaps|フラップ|플랩|Volets|Klappen|Flaps
起落架|Gear|ギア|랜딩기어|Train|Fahrwerk|Tren
收上 UP|UP|UP 上げ|UP 올림|UP rentré|UP ein|UP arriba
放下 DN|DN|DN 下げ|DN 내림|DN sorti|DN aus|DN abajo
自动刹车|Autobrake|オートブレーキ|오토브레이크|Autofreinage|Autobremse|Autofreno
其他|Other|その他|기타|Autres|Sonstiges|Otros
电源|Power|電源|전원|Alimentation|Strom|Energía
停留刹车|Parking Brake|パーキングブレーキ|주차 브레이크|Frein de parking|Parkbremse|Freno de estacionamiento
推出|Pushback|プッシュバック|푸시백|Repoussage|Pushback|Pushback
扰流板预位|Spoilers Armed|スポイラーアーム|스포일러 암|Spoilers armés|Spoiler scharf|Spoilers armados
减速板|Speed Brake|スピードブレーキ|스피드 브레이크|Aérofreins|Bremsklappen|Aerofrenos
发动机|Engines|エンジン|엔진|Moteurs|Triebwerke|Motores
发 1 起动|Start ENG 1|ENG 1 始動|ENG 1 시동|Démarrer MOT 1|TW 1 starten|Arrancar MOT 1
发 2 起动|Start ENG 2|ENG 2 始動|ENG 2 시동|Démarrer MOT 2|TW 2 starten|Arrancar MOT 2
全部起动|Start All|全始動|모두 시동|Tout démarrer|Alle starten|Arrancar todos
反推 1|Reverser 1|リバーサー 1|역추진 1|Inverseur 1|Umkehrschub 1|Reversa 1
反推 2|Reverser 2|リバーサー 2|역추진 2|Inverseur 2|Umkehrschub 2|Reversa 2
灯光|Lights|ライト|조명|Feux|Lichter|Luces
气压基准|Baro Ref|気圧規正|기압 기준|Calage altimétrique|Höhenmessereinstellung|Reglaje altimétrico
PFD · 机长|PFD · Captain|PFD · 機長|PFD · 기장|PFD · Commandant|PFD · Kapitän|PFD · Comandante
ND · 机长|ND · Captain|ND · 機長|ND · 기장|ND · Commandant|ND · Kapitän|ND · Comandante
ECAM 上 · 发动机/告警|Upper ECAM · Engine/Warning|ECAM 上 · エンジン／警告|ECAM 상단 · 엔진/경고|ECAM sup. · Moteurs/Alarmes|ECAM oben · Triebwerk/Warnung|ECAM sup. · Motor/Alertas
ECAM 下 · 系统|Lower ECAM · Systems|ECAM 下 · システム|ECAM 하단 · 시스템|ECAM inf. · Systèmes|ECAM unten · Systeme|ECAM inf. · Sistemas
ND · 副驾|ND · First Officer|ND · 副操縦士|ND · 부기장|ND · Copilote|ND · Copilot|ND · Copiloto
PFD · 副驾|PFD · First Officer|PFD · 副操縦士|PFD · 부기장|PFD · Copilote|PFD · Copilot|PFD · Copiloto
ND 量程 +|ND Range +|ND レンジ +|ND 범위 +|Échelle ND +|ND-Bereich +|Escala ND +
ND 量程 −|ND Range −|ND レンジ −|ND 범위 −|Échelle ND −|ND-Bereich −|Escala ND −
模式|Mode|モード|모드|Mode|Modus|Modo
地形显示|Terrain display|地形表示|지형 표시|Affichage relief|Geländeanzeige|Mostrar terreno
地形|Terrain|地形|지형|Relief|Gelände|Terreno
气象雷达|Weather radar|気象レーダー|기상 레이더|Radar météo|Wetterradar|Radar meteorológico
气象|Weather|気象|기상|Météo|Wetter|Meteo
空速|Airspeed|対気速度|대기 속도|Vitesse air|Fahrt|Velocidad aérea
马赫|Mach|マッハ|마하|Mach|Mach|Mach
离地|Radio Alt|電波高度|전파 고도|Hauteur radio|Radarhöhe|Radioaltímetro
升降|V/S|昇降率|승강률|V/S|V/S|V/S
航迹|Track|航跡|항적|Route|Kurs über Grund|Derrota
地速|Ground Speed|対地速度|지상 속도|Vitesse sol|Grundgeschwindigkeit|Velocidad suelo
风|Wind|風|바람|Vent|Wind|Viento
全重|Gross Weight|総重量|총중량|Masse|Gewicht|Peso bruto
飞行时间|Flight Time|飛行時間|비행 시간|Temps de vol|Flugzeit|Tiempo de vuelo
主警戒|Master Caution|マスターコーション|마스터 주의|Master Caution|Master Caution|Precaución maestra
主警告|Master Warning|マスターワーニング|마스터 경고|Master Warning|Master Warning|Alarma maestra
已暂停|Paused|一時停止中|일시정지됨|En pause|Pausiert|En pausa
继续飞行|Resume Flight|フライト再開|비행 계속|Reprendre le vol|Flug fortsetzen|Reanudar vuelo
返回主菜单|Main Menu|メインメニューへ|메인 메뉴|Menu principal|Hauptmenü|Menú principal
重新选择场景|Choose Another Scenario|シナリオを選び直す|시나리오 다시 선택|Changer de scénario|Szenario neu wählen|Elegir otro escenario
关于 / 致谢 / 资源许可|About / Credits / Licenses|情報／クレジット／ライセンス|정보 / 크레딧 / 라이선스|À propos / Crédits / Licences|Über / Credits / Lizenzen|Acerca de / Créditos / Licencias
关闭|Close|閉じる|닫기|Fermer|Schließen|Cerrar
操作说明|Help|操作説明|조작 설명|Aide|Hilfe|Ayuda
飞行操纵（默认键位）|Flight Controls (default keys)|操縦（標準キー）|비행 조종 (기본 키)|Commandes de vol (touches par défaut)|Flugsteuerung (Standardtasten)|Controles de vuelo (teclas por defecto)
推杆低头 / 拉杆抬头（也可|Pitch down / pitch up (also|機首下げ／機首上げ（または|기수 내림 / 기수 올림 (또는|Piquer / cabrer (aussi|Nase runter / hoch (auch|Picar / encabritar (también
左 / 右横滚（也可|Roll left / right (also|左／右ロール（または|좌 / 우 롤 (또는|Roulis gauche / droite (aussi|Rollen links / rechts (auch|Alabeo izq. / der. (también
方向舵 / 前轮转向（小键盘|Rudder / nosewheel steering (numpad|ラダー／前輪操向（テンキー|방향타 / 앞바퀴 조향 (숫자패드|Gouverne de direction / roulette (pavé num.|Seitenruder / Bugradlenkung (Ziffernblock|Timón / rueda de morro (teclado num.
，或|, or|、または|, 또는|, ou|, oder|, o
鼠标驾驶杆 开/关（光标相对屏幕中心 = 杆量）|Mouse yoke on/off (cursor offset from center = stick input)|マウス操縦桿 オン／オフ（中央からの位置＝操縦量）|마우스 조종간 켜기/끄기 (중앙 기준 커서 = 조종량)|Manche souris on/off (décalage = commande)|Maussteuerung ein/aus (Abstand zur Mitte = Ausschlag)|Palanca con ratón on/off (desplazamiento = mando)
或|or|または|또는|ou|oder|o
油门 加 / 减|Throttle up / down|スロットル 増／減|스로틀 증가 / 감소|Manettes + / −|Schub + / −|Acelerador + / −
TOGA / 爬升推力 / 慢车|TOGA / climb thrust / idle|TOGA／上昇推力／アイドル|TOGA / 상승 추력 / 아이들|TOGA / poussée montée / ralenti|TOGA / Steigschub / Leerlauf|TOGA / empuje de ascenso / ralentí
升降舵配平 低头 / 抬头|Elevator trim down / up|エレベータートリム 下げ／上げ|승강타 트림 내림 / 올림|Trim de profondeur piqué / cabré|Höhentrimm runter / hoch|Compensador abajo / arriba
（按住）|(hold)|（長押し）|(누르고 있기)|(maintenir)|(halten)|(mantener)
机轮刹车|Wheel brakes|ホイールブレーキ|휠 브레이크|Freins|Radbremsen|Frenos
空格|Space|スペース|스페이스|Espace|Leertaste|Espacio
暂停 / 继续|Pause / resume|一時停止／再開|일시정지 / 계속|Pause / reprise|Pause / weiter|Pausa / reanudar
飞机系统|Aircraft Systems|機体システム|항공기 시스템|Systèmes avion|Flugzeugsysteme|Sistemas del avión
起落架 收/放|Gear up/down|ギア 上げ／下げ|랜딩기어 올림/내림|Train rentré/sorti|Fahrwerk ein/aus|Tren arriba/abajo
襟翼 收一档 / 放一档（|Flaps up / down one step (|フラップ 1段上げ／下げ（|플랩 한 단계 올림 / 내림 (|Volets −1 / +1 cran (|Klappen eine Stufe ein / aus (|Flaps subir / bajar un punto (
也可放）|also extends)|でも下げ）|로도 내림)|sort aussi)|fährt auch aus)|también baja)
反推预位|Arm reversers|リバーサーアーム|역추진 준비|Armer les inverseurs|Umkehrschub scharf|Armar reversas
电池 / 电源主开关（冷舱启动时先接通，座舱点亮）|Battery / master power (turn on first in a cold & dark start)|バッテリー／主電源（コールドスタートでは最初にオン）|배터리 / 주전원 (콜드 스타트 시 먼저 켜기)|Batterie / alimentation (en premier en démarrage à froid)|Batterie / Hauptstrom (beim Kaltstart zuerst)|Batería / energía principal (primero en arranque en frío)
APU 起动（配合|APU start (use with|APU 始動（|APU 시동 (|Démarrage APU (avec|APU-Start (mit|Arranque APU (con
起动发动机）|to start engines)|でエンジン始動）|로 엔진 시동)|pour démarrer les moteurs)|Triebwerke starten)|para arrancar motores)
地面推出（牵引车，再按一次停止）|Pushback (tug; press again to stop)|プッシュバック（もう一度押すと停止）|푸시백 (토잉카, 다시 누르면 정지)|Repoussage (tracteur ; rappuyer pour arrêter)|Pushback (Schlepper; erneut drücken zum Stoppen)|Pushback (remolcador; pulsar de nuevo para parar)
自动驾驶|Autopilot|オートパイロット|오토파일럿|Pilote automatique|Autopilot|Piloto automático
自动驾驶 接通 / 断开（断开后再按一次消除警告音；A/THR 保持）|Autopilot on / off (press again to silence the warning; A/THR stays)|AP オン／オフ（再押しで警告音停止、A/THR は維持）|AP 연결 / 해제 (다시 눌러 경고음 해제, A/THR 유지)|PA on / off (rappuyer pour couper l'alarme ; A/THR reste)|AP ein / aus (erneut drücken stoppt Warnton; A/THR bleibt)|AP on / off (pulsar otra vez para silenciar; A/THR sigue)
自动油门|Autothrust|オートスラスト|오토스러스트|Auto-manettes|Autoschub|Autoempuje
航向 HDG / 水平导航 LNAV|Heading HDG / lateral nav LNAV|方位 HDG／LNAV|방위 HDG / LNAV|Cap HDG / LNAV|Kurs HDG / LNAV|Rumbo HDG / LNAV
高度 ALT / 垂直速度 V/S / FLCH|Altitude ALT / V/S / FLCH|高度 ALT／V/S／FLCH|고도 ALT / V/S / FLCH|Altitude ALT / V/S / FLCH|Höhe ALT / V/S / FLCH|Altitud ALT / V/S / FLCH
APPR 进近预位 / SPD-MACH 切换|APPR arm / SPD-MACH toggle|APPR アーム／SPD-MACH 切替|APPR 준비 / SPD-MACH 전환|APPR armé / bascule SPD-MACH|APPR scharf / SPD-MACH umschalten|APPR armado / cambiar SPD-MACH
目标高度 ∓|Target altitude ∓|目標高度 ∓|목표 고도 ∓|Altitude cible ∓|Zielhöhe ∓|Altitud objetivo ∓
航向 ∓|Heading ∓|方位 ∓|방위 ∓|Cap ∓|Kurs ∓|Rumbo ∓
速度 ∓|Speed ∓|速度 ∓|속도 ∓|Vitesse ∓|Geschwindigkeit ∓|Velocidad ∓
视角与界面|Views & Interface|視点とUI|시점 및 UI|Vues et interface|Ansichten & Oberfläche|Vistas e interfaz
循环切换视角（驾驶舱 / 追踪 / 自由 …），也可点顶栏 🎥 视角按钮|Cycle views (cockpit / chase / free …), or use the 🎥 button in the top bar
驾驶舱 / 机翼 / 追踪 / 塔台 / 环绕 / 自由 / 飞掠|Cockpit / wing / chase / tower / orbit / free / flyby|コックピット／翼／追跡／タワー／周回／フリー／フライバイ|조종석 / 날개 / 추적 / 관제탑 / 궤도 / 자유 / 플라이바이|Cockpit / aile / poursuite / tour / orbite / libre / passage|Cockpit / Flügel / Verfolger / Tower / Orbit / frei / Vorbeiflug|Cabina / ala / persecución / torre / órbita / libre / pasada
在画面上拖拽鼠标|Drag the mouse on screen|画面をマウスでドラッグ|화면에서 마우스 드래그|Glisser la souris|Maus auf dem Bild ziehen|Arrastrar el ratón
环视（鼠标驾驶杆开启时用右键拖拽）；外部视角滚轮缩放|Look around (right-drag when mouse yoke is on); wheel zooms in external views
触摸|Touch|タッチ|터치|Tactile|Touch|Táctil
单指拖动 = 驾驶杆，第二根手指拖动 = 环视|One-finger drag = stick, second finger drag = look around
驾驶舱视角|Cockpit view|コックピット視点|조종석 시점|Vue cockpit|Cockpitansicht|Vista de cabina
默认三维驾驶舱（机长座位）；拖拽鼠标 / 摇杆苦力帽环视，|Default 3D cockpit (captain's seat); look around with mouse drag / hat switch,
小键盘 5|Numpad 5|テンキー 5|숫자패드 5|Pavé num. 5|Ziffernblock 5|Teclado num. 5
视线回正|recenters view
看向仪表板（低头 + 放大，仪表清晰可读）/ 恢复向外看，也可点顶栏 🔍 仪表板|Look at the panel (tilt down + zoom for readable instruments) / look outside; or use 🔍 Panel in the top bar
三维驾驶舱开关|3D cockpit switches|3Dコックピットのスイッチ|3D 조종석 스위치|Interrupteurs du cockpit 3D|3D-Cockpit-Schalter|Interruptores de cabina 3D
左键 = 正向 / 接通 / 放出；右键或 Shift+左键 = 反向 / 断开 / 收起；旋钮、油门、襟翼、减速板可用滚轮或拖动|Left click = forward / on / extend; right click or Shift+left = reverse / off / retract; knobs, throttle, flaps and speed brake respond to wheel or drag
点击 FCU / MCP|Click FCU / MCP|FCU／MCP をクリック|FCU / MCP 클릭|Cliquer FCU / MCP|FCU / MCP klicken|Clic en FCU / MCP
遮光板按钮可点；旋钮左 / 右半边 = 减 / 加（可按住或滚轮），上半 = PUSH，下半 = PULL；点击起落架手柄收放|Glareshield buttons are clickable; knob left / right half = dec / inc (hold or wheel), top half = PUSH, bottom half = PULL; click the gear lever to raise/lower
显示 / 隐藏侧边面板（检查单、操纵台）|Show / hide side panels (checklist, pedestal)|サイドパネル表示切替（チェックリスト、ペデスタル）|사이드 패널 표시/숨기기 (체크리스트, 페데스탈)|Afficher / masquer les panneaux|Seitenleisten ein / aus|Mostrar / ocultar paneles
显示 / 隐藏整个界面|Show / hide the whole UI|UI 全体の表示切替|전체 UI 표시/숨기기|Afficher / masquer l'interface|Gesamte UI ein / aus|Mostrar / ocultar la interfaz
本说明|This help|この説明|이 도움말|Cette aide|Diese Hilfe|Esta ayuda
暂停菜单|Pause menu|一時停止メニュー|일시정지 메뉴|Menu pause|Pausenmenü|Menú de pausa
静音 / HUD / 时间倍率|Mute / HUD / time rate|ミュート／HUD／時間倍率|음소거 / HUD / 시간 배율|Muet / HUD / vitesse du temps|Stumm / HUD / Zeitraffer|Silencio / HUD / velocidad
截图|Screenshot|スクリーンショット|스크린샷|Capture d'écran|Screenshot|Captura
手柄 / 摇杆|Gamepad / Joystick|ゲームパッド／ジョイスティック|게임패드 / 조이스틱|Manette / Joystick|Gamepad / Joystick|Mando / Joystick
Xbox/PS 手柄|Xbox/PS controller|Xbox/PS コントローラー|Xbox/PS 컨트롤러|Manette Xbox/PS|Xbox/PS-Controller|Mando Xbox/PS
左摇杆 = 杆，LB/RB = 方向舵，LT/RT = 油门，A 起落架，X 刹车，Y 视角，十字键 襟翼|Left stick = yoke, LB/RB = rudder, LT/RT = throttle, A gear, X brakes, Y view, D-pad flaps
飞行摇杆 / TCA|Flight stick / TCA|フライトスティック／TCA|비행 조이스틱 / TCA|Joystick de vol / TCA|Flugstick / TCA|Joystick de vuelo / TCA
顶栏 🕹 摇杆 或 菜单"摇杆设置"中映射轴与按钮（AP 断开 / PTT / 刹车）；Chrome/Edge 需先按一下摇杆按钮|Map axes and buttons (AP disconnect / PTT / brakes) via 🕹 Joystick in the top bar or "Joystick Settings" in the menu; Chrome/Edge need a button press first
脚舵 (方向舵踏板)|Rudder pedals|ラダーペダル|러더 페달|Palonniers|Seitenruderpedale|Pedales de timón
自动识别为脚舵：踏板 = 方向舵，左/右趾刹 = 刹车，不会占用俯仰/横滚；与摇杆同时连接时方向舵以脚舵为准|Auto-detected as pedals: pedals = rudder, left/right toe brakes = brakes, never pitch/roll; with a stick connected, the pedals take rudder priority
飞行小贴士|Flying Tips|フライトのヒント|비행 팁|Conseils de vol|Flugtipps|Consejos de vuelo
起飞：|Takeoff:|離陸：|이륙:|Décollage :|Start:|Despegue:
襟翼放至起飞位（F/V 键或点击操纵台），推油门至 TOGA，达到 VR 后轻拉杆， 正上升率后收起落架，按速度收襟翼。|Set takeoff flaps (F/V keys or the pedestal), advance thrust to TOGA, rotate gently at VR, raise the gear with positive climb, and retract flaps on speed.
爬升：|Climb:|上昇：|상승:|Montée :|Steigflug:|Ascenso:
保持目标速度约 250 kt 至 10000 ft，之后加速到 300 kt / M0.78。|Hold about 250 kt to 10,000 ft, then accelerate to 300 kt / M0.78.
巡航：|Cruise:|巡航：|순항:|Croisière :|Reiseflug:|Crucero:
接通 AP 与 A/THR，使用 ALT 保持高度、MACH 保持马赫数。|Engage AP and A/THR; use ALT to hold altitude and MACH to hold Mach.
下降：|Descent:|降下：|강하:|Descente :|Sinkflug:|Descenso:
下降率不超过 2000 fpm，提前 3 nm/1000 ft 开始下高。|Keep descent under 2,000 fpm; start down 3 nm per 1,000 ft early.
进近：|Approach:|進入：|접근:|Approche :|Anflug:|Aproximación:
设定 ILS 频率，APPR 预位，截获 LOC 与 G/S 后放起落架与着陆襟翼， 自动刹车选择 LO 或 2。|Set the ILS frequency, arm APPR, and after LOC and G/S capture extend gear and landing flaps; set autobrake LO or 2.
着陆：|Landing:|着陸：|착륙:|Atterrissage :|Landung:|Aterrizaje:
50 ft 开始收油门，20 ft 柔和拉平，接地后拉反推并使用方向舵保持中心线。|Retard thrust at 50 ft, flare gently at 20 ft, then use reversers and rudder to hold the centerline after touchdown.
冷舱启动检查单|Cold & Dark Checklist|コールド＆ダーク チェックリスト|콜드 앤 다크 체크리스트|Check-list démarrage à froid|Kaltstart-Checkliste|Lista de arranque en frío
主菜单「飞行场景」选「冷舱启动」；其他场景开局时所有开关已在运行位置。全部步骤都可用鼠标点击三维驾驶舱完成（左键正向 / 右键反向 / 滚轮），ECAM 下方青色 ▶ 行提示下一步。|Choose "Cold & Dark" under Scenario in the main menu; other scenarios start with all switches set. Every step can be done by clicking the 3D cockpit (left = forward / right = reverse / wheel); the cyan ▶ line on the lower ECAM shows the next step.
电源：|Power:|電源：|전원:|Alimentation :|Strom:|Energía:
头顶板 ELEC — BAT 1 + BAT 2 ON（OFF 灯熄灭），EXT PWR ON（AVAIL → ON），显示器通电。|Overhead ELEC — BAT 1 + BAT 2 ON (OFF lights out), EXT PWR ON (AVAIL → ON); displays power up.
IR 1/2/3 旋到 NAV（对准约 75 秒，PFD/ND 显示 ALIGN，对准完成后才有姿态、地图与自动驾驶）。|Turn IR 1/2/3 to NAV (about 75 s to align; PFD/ND show ALIGN; attitude, map and autopilot come after alignment).
燃油 / 灯光：|Fuel / Lights:|燃料／ライト：|연료 / 조명:|Carburant / feux :|Treibstoff / Licht:|Combustible / luces:
FUEL 6 个泵 ON；EXT LT 打开 BEACON 与 NAV；SIGNS 安全带 ON。|All 6 FUEL pumps ON; EXT LT BEACON and NAV on; SIGNS seat belts ON.
MASTER SW → START，约 30 秒后 AVAIL；AIR COND 面板 APU BLEED ON（X BLEED 保持 AUTO）。|MASTER SW → START, AVAIL after about 30 s; AIR COND panel APU BLEED ON (X BLEED stays AUTO).
起动：|Start:|始動：|시동:|Démarrage :|Anlassen:|Arranque:
操纵台 ENG MODE 旋到 IGN START → ENG MASTER 2 ON，等慢车后 ENG MASTER 1 ON（每台约 40 秒）。|Pedestal ENG MODE to IGN START → ENG MASTER 2 ON, after idle ENG MASTER 1 ON (about 40 s each).
起动后：|After start:|始動後：|시동 후:|Après démarrage :|Nach dem Anlassen:|Tras el arranque:
ENG MODE 回 NORM，APU BLEED OFF，PACK 1/2 ON，襟翼起飞位，松开停留刹车滑行。|ENG MODE back to NORM, APU BLEED OFF, PACK 1/2 ON, takeoff flaps, release the parking brake and taxi.
波音布局|Boeing layout|ボーイング配置|보잉 배치|Disposition Boeing|Boeing-Layout|Disposición Boeing
（737 / 737 MAX / 777 / 787 / E190）：BATTERY + STBY PWR，GRD PWR，IRS L/R → NAV，燃油泵，APU + START，APU BLEED，ENGINE START 旋到 GRD，FUEL CONTROL → RUN（起动完成后 START 自动回 OFF）。|(737 / 737 MAX / 777 / 787 / E190): BATTERY + STBY PWR, GRD PWR, IRS L/R → NAV, fuel pumps, APU + START, APU BLEED, ENGINE START to GRD, FUEL CONTROL → RUN (START returns to OFF automatically).
本模拟器使用真实的六自由度飞行动力学模型：升力/阻力随迎角与马赫数变化、失速与过失速特性、 地面效应、跨音速阻力发散、起落架弹簧阻尼与轮胎侧偏、发动机转子滞后与高空推力衰减、 燃油消耗引起重量与重心变化。各机型的展弦比、后掠角、发动机推力均按公开数据建模。|This simulator uses a realistic six-degree-of-freedom flight model: lift/drag vary with angle of attack and Mach, stall and post-stall behavior, ground effect, transonic drag rise, spring-damped gear and tire slip, engine spool lag and thrust lapse with altitude, and weight/CG change from fuel burn. Aspect ratio, sweep and thrust of each aircraft are modeled from public data.
明白了|Got it|了解|알겠습니다|Compris|Verstanden|Entendido
已暂停 — 按 空格 或 P 继续|Paused — press Space or P to resume|一時停止中 — スペースまたは P で再開|일시정지 — 스페이스 또는 P로 계속|En pause — Espace ou P pour reprendre|Pausiert — Leertaste oder P zum Fortsetzen|En pausa — Espacio o P para reanudar
支持 Thrustmaster TCA 空客侧杆、TCA 油门台 (Quadrant)、方向舵脚舵及其他 HID 飞行摇杆。 每台设备只使用与其类型相符的轴 (或你手动绑定的轴); 多台设备同时连接时, 俯仰/横滚以侧杆为准, 方向舵以脚舵为准。|Supports the Thrustmaster TCA Airbus sidestick, TCA Quadrant, rudder pedals and other HID flight sticks. Each device only uses the axes that match its type (or that you bind manually); with several devices, pitch/roll follow the sidestick and rudder follows the pedals.
Chrome / Edge 需要先按一下摇杆上的任意按钮 (或动一下轴), 浏览器才会把设备报告给网页。|In Chrome / Edge, press any joystick button (or move an axis) first so the browser exposes the device.|Chrome／Edge ではまずジョイスティックのボタンを押す（軸を動かす）必要があります。|Chrome / Edge에서는 먼저 조이스틱 버튼을 누르거나 축을 움직여야 합니다.|Dans Chrome / Edge, appuyez d'abord sur un bouton (ou bougez un axe).|In Chrome / Edge zuerst eine Taste drücken (oder eine Achse bewegen).|En Chrome / Edge, pulse primero un botón (o mueva un eje).
设置自动保存在本机浏览器 (localStorage)。|Settings are saved automatically in this browser (localStorage).|設定はこのブラウザに自動保存されます (localStorage)。|설정은 이 브라우저에 자동 저장됩니다 (localStorage).|Réglages enregistrés automatiquement (localStorage).|Einstellungen werden automatisch gespeichert (localStorage).|Los ajustes se guardan automáticamente (localStorage).
恢复默认|Reset Defaults|初期設定に戻す|기본값 복원|Réinitialiser|Standard wiederherstellen|Restablecer
完成|Done|完了|완료|Terminé|Fertig|Listo
微软商店有新版本 {v}，点击前往更新|New version {v} on the Microsoft Store — click to update|Microsoft Store に新バージョン {v} があります。クリックして更新|Microsoft Store에 새 버전 {v}이(가) 있습니다. 클릭하여 업데이트|Nouvelle version {v} sur le Microsoft Store — cliquez pour mettre à jour|Neue Version {v} im Microsoft Store – zum Aktualisieren klicken|Nueva versión {v} en Microsoft Store: haga clic para actualizar
发现新版本 {v}（当前 {c}）|New version {v} available (current {c})|新バージョン {v}（現在 {c}）|새 버전 {v} (현재 {c})|Nouvelle version {v} (actuelle {c})|Neue Version {v} (aktuell {c})|Nueva versión {v} (actual {c})
前往微软商店|Open Microsoft Store|Microsoft Store を開く|Microsoft Store 열기|Ouvrir le Microsoft Store|Microsoft Store öffnen|Abrir Microsoft Store
查看发布页|View Release|リリースを見る|릴리스 보기|Voir la version|Release ansehen|Ver versión
无法检查更新|Unable to check for updates|アップデートを確認できません|업데이트를 확인할 수 없습니다|Impossible de vérifier les mises à jour|Updateprüfung nicht möglich|No se pueden buscar actualizaciones
已是最新版本（{c}）|You're up to date ({c})|最新バージョンです（{c}）|최신 버전입니다 ({c})|Vous êtes à jour ({c})|Aktuellste Version ({c})|Ya tiene la última versión ({c})
检查更新失败，请检查网络连接|Update check failed — please check your connection|確認に失敗しました。接続を確認してください|업데이트 확인 실패, 네트워크를 확인하세요|Échec de la vérification, vérifiez votre connexion|Updateprüfung fehlgeschlagen – Verbindung prüfen|Error al buscar actualizaciones; revise la conexión
`;
  var DICT = {};
  RAW.split('\n').forEach(function (l) { if (!l.trim()) return; var p = l.split('|'); DICT[p[0].trim()] = p.slice(1); });
  // 运行时词典 (js/i18n-runtime.js): English 为 @ 时沿用上面的英文
  String(FS.I18N_RAW2 || '').split('\n').forEach(function (l) {
    if (!l.trim()) return; var p = l.split('|'), k = p[0].trim(), v = p.slice(1).map(function (x) { return x.trim(); });
    if (v[0] === '@') v[0] = (DICT[k] && DICT[k][0]) || k;
    DICT[k] = v;
  });
  // 片段替换: 拼接出的提示 (如 '起落架 ' + '放下') 按最长中文片段逐段翻译
  var CJK = /[\u3400-\u9fff]/;
  var FRAG = Object.keys(DICT).filter(function (k) { return CJK.test(k); })
    .sort(function (a, b) { return b.length - a.length; })
    .map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
  var FRAG_RE = FRAG.length ? new RegExp(FRAG.join('|'), 'g') : null;
  function tFrag(s) {
    if (lang === 'zh' || !FRAG_RE || !CJK.test(s)) return s;
    var spaced = lang !== 'ja';
    return s.replace(FRAG_RE, function (m, off, all) {
      var r = t(m);
      if (spaced) {
        var b = all.charAt(off - 1), a = all.charAt(off + m.length);
        if (b && /[\w)\]%]/.test(b)) r = ' ' + r;
        if (a && /[\w(\[]/.test(a)) r = r + ' ';
      }
      return r;
    });
  }

  function detect() {
    var s = null; try { s = global.localStorage.getItem(KEY); } catch (e) { /* */ }
    if (s && LANGS.some(function (l) { return l[0] === s; })) return s;
    var n = String((global.navigator && global.navigator.language) || 'zh').toLowerCase().slice(0, 2);
    return LANGS.some(function (l) { return l[0] === n; }) ? n : (n === 'zh' ? 'zh' : 'en');
  }
  var lang = detect();
  var IDX = { en: 0, ja: 1, ko: 2, fr: 3, de: 4, es: 5 };

  /** 翻译中文原文; vars 替换 {v} 等占位 */
  function t(zh, vars) {
    var out = zh, row = DICT[zh];
    if (lang !== 'zh' && row) out = row[IDX[lang]] || row[0] || zh;
    if (vars) out = out.replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; });
    return out;
  }

  // ---- DOM 替换: 记住原文, 切换语言时可还原 ----
  var ORIG = new WeakMap(), ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'label'];
  var busy = false;
  function trText(node) {
    var o = ORIG.get(node), cur = node.nodeValue;
    if (o === undefined || (cur !== o.out)) { o = { src: cur }; }
    var key = o.src.replace(/\s+/g, ' ').trim();
    if (!key || !CJK.test(key)) return;
    var lead = o.src.match(/^\s*/)[0], tail = o.src.match(/\s*$/)[0];
    o.out = lead + (DICT[key] ? t(key) : tFrag(key)) + tail;
    ORIG.set(node, o);
    if (cur !== o.out) node.nodeValue = o.out;
  }
  function trEl(el) {
    var en = el.getAttribute('data-i18n-en');
    if (en != null) { var v2 = lang === 'zh' ? el.getAttribute('data-i18n-zh') : en; if (v2 != null && el.textContent !== v2) el.textContent = v2; return; }
    var m = ORIG.get(el) || {};
    ATTRS.forEach(function (a) {
      var v = el.getAttribute(a); if (v == null) return;
      if (!m[a] || v !== m[a].out) m[a] = { src: v };
      var key = m[a].src.trim(); if (!CJK.test(key)) return;
      m[a].out = DICT[key] ? t(key) : tFrag(key); if (v !== m[a].out) el.setAttribute(a, m[a].out);
    });
    ORIG.set(el, m);
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { trText(root); return; }
    if (root.nodeType !== 1 || /^(SCRIPT|STYLE|CANVAS)$/.test(root.tagName)) return;
    trEl(root);
    if (root.hasAttribute('data-i18n-en')) return;
    for (var c = root.firstChild; c; c = c.nextSibling) walk(c);
  }
  function apply() {
    var d = global.document; if (!d || !d.body) return;
    busy = true;
    try {
      walk(d.body);
      d.documentElement.lang = { zh: 'zh-CN', en: 'en', ja: 'ja', ko: 'ko', fr: 'fr', de: 'de', es: 'es' }[lang];
      d.title = t('天际航线 SkyRoute');
    } finally { busy = false; }
  }
  function setLang(l) {
    lang = l; try { global.localStorage.setItem(KEY, l); } catch (e) { /* */ }
    apply();
  }

  FS.I18N = { t: t, tf: tFrag, zh: function () { return lang === 'zh'; }, setLang: setLang, getLang: function () { return lang; }, langs: LANGS, apply: apply, _dict: DICT };
  FS.t = t;

  var d = global.document;
  if (d && d.addEventListener) {
    var go = function () {
      var sel = d.getElementById('lang-select');
      if (sel) {
        sel.innerHTML = LANGS.map(function (l) { return '<option value="' + l[0] + '">' + l[1] + '</option>'; }).join('');
        sel.value = lang;
        sel.addEventListener('change', function () { setLang(sel.value); });
      }
      apply();
      if (global.MutationObserver) new MutationObserver(function (ms) {
        if (busy) return; busy = true;
        try { ms.forEach(function (m) {
          if (m.type === 'characterData') trText(m.target);
          else if (m.type === 'attributes') trEl(m.target);
          else m.addedNodes.forEach(walk);
        }); } finally { busy = false; }
      }).observe(d.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(['data-i18n-en']) });
    };
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', go); else go();
  }
})(typeof window !== 'undefined' ? window : this);
