import React, { useState, useMemo } from "react";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Building2,
  Smartphone,
  Banknote,
  Repeat,
  Clock,
  ShieldCheck,
  FileText,
} from "lucide-react";

// ---------- Design tokens ----------
const COLORS = {
  bg: "#0B1420",
  bgCard: "#121F30",
  bgCardAlt: "#16263A",
  border: "#223349",
  gold: "#C9A227",
  goldSoft: "#E4C766",
  teal: "#1F8A78",
  textPrimary: "#EDEAE0",
  textMuted: "#8B96A8",
  danger: "#D9694F",
};

// ---------- Business config (editable) ----------
// Taux de change MAD <-> devise, différents selon le sens de la
// transaction, pour chaque devise CFA gérée par la plateforme :
// - Quand on envoie en MAD pour recevoir dans cette devise : 1 MAD = X
// - Quand on envoie dans cette devise pour recevoir en MAD : 1 MAD = Y
// (Y > X reflète une marge à l'achat/vente, comme un bureau de change.)
const DIRECTIONAL_RATES = {
  XOF: { madToCurrency: 60, currencyToMad: 62 },
  XAF: { madToCurrency: 60, currencyToMad: 62 },
  // Franc congolais (CDF, RD Congo).
  CDF: { madToCurrency: 244.85, currencyToMad: 254 },
  // Franc guinéen (GNF, Guinée).
  GNF: { madToCurrency: 935, currencyToMad: 988 },
};

// Taux directs entre certaines paires de devises, quand ils ont été
// négociés séparément plutôt que déduits en passant par le MAD (ex: le
// CDF et le XOF ont leur propre taux direct, différent de celui obtenu
// via une conversion CDF -> MAD -> XOF).
const CROSS_RATES = {
  CDF: { XOF: 1 / 5 }, // 5 CDF = 1 XOF (envoi depuis la RD Congo vers la Côte d'Ivoire)
  XOF: { CDF: 3.5, GNF: 15.5 }, // 1 XOF = 3,5 CDF · 1 XOF = 15,5 GNF
  GNF: { XOF: 1 / 17.7 }, // 17,7 GNF = 1 XOF (envoi depuis la Guinée vers la Côte d'Ivoire)
};

// Convertit un montant d'une devise à une autre en appliquant le bon taux
// selon le sens de la transaction.
function convertAmount(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;

  if (fromCurrency === "MAD") {
    return amount * DIRECTIONAL_RATES[toCurrency].madToCurrency;
  }
  if (toCurrency === "MAD") {
    return amount / DIRECTIONAL_RATES[fromCurrency].currencyToMad;
  }

  // Taux négocié directement entre ces deux devises (prioritaire).
  const direct = CROSS_RATES[fromCurrency]?.[toCurrency];
  if (direct !== undefined) {
    return amount * direct;
  }

  // Sinon, deux devises entre elles : on passe par le MAD.
  const amountInMAD = amount / DIRECTIONAL_RATES[fromCurrency].currencyToMad;
  return amountInMAD * DIRECTIONAL_RATES[toCurrency].madToCurrency;
}

// Grille de frais par palier, exprimée en MAD. Le montant envoyé est
// d'abord converti en MAD pour trouver le palier, puis les frais sont
// reconvertis dans la devise d'envoi.
const FEE_TIERS = [
  { min: 250, max: 650, fee: 30 },
  { min: 651, max: 1500, fee: 50 },
  { min: 1501, max: 2500, fee: 70 },
  { min: 2501, max: 5000, fee: 90 },
  { min: 5001, max: 15000, fee: 135 },
  { min: 15001, max: 30000, fee: 170 },
];

// Montant minimum autorisé pour un envoi, exprimé en CFA. Converti
// automatiquement dans la devise du réseau choisi via le taux
// devise -> MAD (le plus défavorable des deux sens).
const MIN_SEND_CFA = 15000;
const MIN_SEND_MAD = MIN_SEND_CFA / DIRECTIONAL_RATES.XOF.currencyToMad;

function minSendFor(currency) {
  if (currency === "MAD") return MIN_SEND_MAD;
  if (currency === "CDF") {
    // Seuil équivalent en CDF au taux courant (voir avertissement sur DIRECTIONAL_RATES.CDF).
    return MIN_SEND_MAD * DIRECTIONAL_RATES.CDF.madToCurrency;
  }
  if (currency === "GNF") {
    // Seuil équivalent en GNF au taux courant (voir avertissement sur DIRECTIONAL_RATES.GNF).
    return MIN_SEND_MAD * DIRECTIONAL_RATES.GNF.madToCurrency;
  }
  return MIN_SEND_CFA; // XOF et XAF utilisent tous deux le seuil de 15 000 CFA
}

// ---------- Pays & réseaux ----------
// Chaque pays porte sa devise. Un réseau peut être disponible dans
// plusieurs pays (ex: Orange Money en Côte d'Ivoire et ailleurs) sans
// être dupliqué — on le référence juste dans plusieurs `countries`.
const COUNTRIES = [
  { id: "ma", name: "Maroc", flag: "🇲🇦", currency: "MAD" },
  { id: "ci", name: "Côte d'Ivoire", flag: "🇨🇮", currency: "XOF" },
  { id: "bf", name: "Burkina Faso", flag: "🇧🇫", currency: "XOF" },
  { id: "ga", name: "Gabon", flag: "🇬🇦", currency: "XAF" },
  { id: "cg", name: "Congo Brazzaville", flag: "🇨🇬", currency: "XAF" },
  { id: "cd", name: "Congo RDC", flag: "🇨🇩", currency: "CDF" },
  { id: "gn", name: "Guinée", flag: "🇬🇳", currency: "GNF" },
  { id: "bj", name: "Bénin", flag: "🇧🇯", currency: "XOF" },
  { id: "tg", name: "Togo", flag: "🇹🇬", currency: "XOF" },
];

const NETWORKS = [
  { id: "cih", name: "CIH Bank", countries: ["ma"], currency: "MAD", type: "bank", icon: Building2 },
  { id: "albarid", name: "Al Barid Bank", countries: ["ma"], currency: "MAD", type: "bank", icon: Building2 },
  { id: "attijari", name: "Attijariwafa Bank", countries: ["ma"], currency: "MAD", type: "bank", icon: Building2 },
  { id: "bmce", name: "BMCE Bank of Africa", countries: ["ma"], currency: "MAD", type: "bank", icon: Building2 },
  { id: "banquepop", name: "Banque Populaire", countries: ["ma"], currency: "MAD", type: "bank", icon: Building2 },
  { id: "cash", name: "En espèces", countries: ["ma"], currency: "MAD", type: "cash", icon: Banknote },
  { id: "orange", name: "Orange Money", countries: ["ci", "bf"], currency: "XOF", type: "mobile", icon: Smartphone },
  { id: "wave", name: "WAVE Money", countries: ["ci", "bf"], currency: "XOF", type: "mobile", icon: Smartphone },
  // Airtel Money existe au Gabon et au Congo Brazzaville, tous deux en XAF
  // — on garde donc un seul réseau "airtel" pour les deux pays.
  { id: "airtel", name: "Airtel Money", countries: ["ga", "cg"], currency: "XAF", type: "mobile", icon: Smartphone },
  { id: "moov", name: "Moov Money", countries: ["ga"], currency: "XAF", type: "mobile", icon: Smartphone },
  { id: "mtn", name: "MTN Money", countries: ["cg"], currency: "XAF", type: "mobile", icon: Smartphone },
  // La RD Congo utilise le CDF (pas le XAF) : Orange Money et Airtel Money
  // y ont donc leurs propres entrées, distinctes de celles en XAF/XOF.
  { id: "orange_cd", name: "Orange Money", countries: ["cd"], currency: "CDF", type: "mobile", icon: Smartphone },
  { id: "airtel_cd", name: "Airtel Money", countries: ["cd"], currency: "CDF", type: "mobile", icon: Smartphone },
  // La Guinée utilise le GNF (pas le XOF) : Orange Money y a donc sa
  // propre entrée, distincte de celle en XOF (Côte d'Ivoire/Burkina Faso).
  { id: "orange_gn", name: "Orange Money", countries: ["gn"], currency: "GNF", type: "mobile", icon: Smartphone },
  // MTN Money et Moov Money existent aussi au Bénin/Togo, mais en XOF
  // (contrairement au Congo Brazzaville/Gabon en XAF) : ce sont donc des
  // entrées à part, avec leur propre devise.
  { id: "mtn_bj", name: "MTN Money", countries: ["bj"], currency: "XOF", type: "mobile", icon: Smartphone },
  { id: "moov_xof", name: "Moov Money", countries: ["bj", "tg"], currency: "XOF", type: "mobile", icon: Smartphone },
  { id: "tmoney", name: "TMoney", countries: ["tg"], currency: "XOF", type: "mobile", icon: Smartphone },
];

function networksForCountry(countryId) {
  return NETWORKS.filter((n) => n.countries.includes(countryId));
}

// Coordonnées de paiement par réseau (nom, prénom, numéro de compte, RIB).
// Pour les réseaux mobile money, il n'y a généralement pas de RIB — le
// champ `rib` reste vide ("") et ne s'affiche simplement pas.
const PAY_INFO = {
  cih: {
    nom: "SOUMAHORO",
    prenom: "MOHAMED RAYAN",
    numeroCompte: "6543905211014700",
    rib: " 230 815 6543905211014700 74",
  },
  albarid: {
    nom: "SOUMAHORO",
    prenom: "MOHAMED RAYAN",
    numeroCompte: "1369283601",
    rib: "350810000000001369283601",
  },
  // ⚠️ Coordonnées à compléter avec tes vraies infos AttijariWafa.
  attijari: {
    nom: "",
    prenom: "",
    numeroCompte: "",
    rib: "",
    note: "À convenir avec un agent MoneyBridge après votre demande",
  },
  // ⚠️ Coordonnées à compléter avec tes vraies infos BMCE.
  bmce: {
    nom: "",
    prenom: "",
    numeroCompte: "",
    rib: "",
    note: "À convenir avec un agent MoneyBridge après votre demande",
  },
  // ⚠️ Coordonnées à compléter avec tes vraies infos Banque Populaire.
  banquepop: {
    nom: "",
    prenom: "",
    numeroCompte: "",
    rib: "",
    note: "À convenir avec un agent MoneyBridge après votre demande",
  },
  orange: {
    nom: "SOUMAHORO",
    prenom: "MOHAMED RAYAN",
    numeroCompte: "",
    rib: "",
    note: "À convenir avec un agent MoneyBridge après votre demande",
  },
  wave: {
    nom: "SOUMAHORO",
    prenom: "MOHAMED RAYAN",
    numeroCompte: "+225 07 10 25 29 39",
    rib: "",
  },
  airtel: {
    nom: "MB",
    prenom: "MB",
    numeroCompte: "",
    rib: "",
    note: "À convenir avec un agent MoneyBridge après votre demande",
  },
  // ⚠️ Coordonnées à compléter avec tes vraies infos Moov Money.
  moov: {
    nom: "",
    prenom: "",
    numeroCompte: "",
    rib: "",
    note: "À convenir avec un agent MoneyBridge après votre demande",
  },
  // ⚠️ Coordonnées à compléter avec tes vraies infos MTN Money.
  mtn: {
    nom: "",
    prenom: "",
    numeroCompte: "",
    rib: "",
    note: "À convenir avec un agent MoneyBridge après votre demande",
  },
  // ⚠️ Coordonnées à compléter avec tes vraies infos Orange Money (RD Congo).
  orange_cd: {
    nom: "",
    prenom: "",
    numeroCompte: "",
    rib: "",
    note: "À convenir avec un agent MoneyBridge après votre demande",
  },
  // ⚠️ Coordonnées à compléter avec tes vraies infos Airtel Money (RD Congo).
  airtel_cd: {
    nom: "",
    prenom: "",
    numeroCompte: "",
    rib: "",
    note: "À convenir avec un agent MoneyBridge après votre demande",
  },
  // ⚠️ Coordonnées à compléter avec tes vraies infos Orange Money (Guinée).
  orange_gn: {
    nom: "",
    prenom: "",
    numeroCompte: "",
    rib: "",
    note: "À convenir avec un agent MoneyBridge après votre demande",
  },
  // ⚠️ Coordonnées à compléter avec tes vraies infos MTN Money (Bénin).
  mtn_bj: {
    nom: "",
    prenom: "",
    numeroCompte: "",
    rib: "",
    note: "À convenir avec un agent MoneyBridge après votre demande",
  },
  // ⚠️ Coordonnées à compléter avec tes vraies infos Moov Money (Bénin/Togo).
  moov_xof: {
    nom: "",
    prenom: "",
    numeroCompte: "",
    rib: "",
    note: "À convenir avec un agent MoneyBridge après votre demande",
  },
  // ⚠️ Coordonnées à compléter avec tes vraies infos TMoney (Togo).
  tmoney: {
    nom: "",
    prenom: "",
    numeroCompte: "",
    rib: "",
    note: "À convenir avec un agent MoneyBridge après votre demande",
  },
  cash: {
    nom: "",
    prenom: "",
    numeroCompte: "",
    rib: "",
    note: "À convenir avec un agent MoneyBridge après votre demande",
  },
};

function formatAmount(n, currency) {
  if (Number.isNaN(n)) return "-";
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${currency}`;
}

// Nombre de chiffres attendu pour le numéro de compte de réception, selon
// le type de réseau : 10 chiffres pour un numéro mobile money, 16 pour un
// numéro de compte bancaire classique, 8 pour Al Barid Bank spécifiquement.
function accountDigitsFor(network) {
  if (network.type === "mobile") return 10;
  if (network.type === "bank") return network.id === "albarid" ? 8 : 16;
  return null; // espèces : aucune coordonnée requise
}

// Un RIB fait toujours 24 chiffres, quelle que soit la banque.
const RIB_DIGITS = 24;

function computeFee(amount, currency) {
  if (!amount || amount <= 0) return 0;

  // On ramène le montant en MAD pour trouver le bon palier.
  const amountInMAD = currency === "MAD" ? amount : convertAmount(amount, currency, "MAD");

  let feeMAD;
  if (amountInMAD < FEE_TIERS[0].min) {
    feeMAD = FEE_TIERS[0].fee; // en dessous de 250 dh, on applique le palier plancher
  } else if (amountInMAD > FEE_TIERS[FEE_TIERS.length - 1].max) {
    feeMAD = FEE_TIERS[FEE_TIERS.length - 1].fee; // au-delà de 30000 dh, palier plafond
  } else {
    const tier = FEE_TIERS.find((t) => amountInMAD >= t.min && amountInMAD <= t.max);
    feeMAD = tier ? tier.fee : FEE_TIERS[FEE_TIERS.length - 1].fee;
  }

  return currency === "MAD" ? feeMAD : convertAmount(feeMAD, "MAD", currency);
}

// Numéro WhatsApp qui reçoit les détails de chaque transaction, au format
// international sans le 0 initial ni le "+".
const WHATSAPP_NUMBER = "212629227603";

function generateOrderId() {
  return `MB-${Date.now().toString(36).toUpperCase()}`;
}

function buildWhatsAppMessage({
  orderId,
  clientNumber,
  date,
  sendNetwork,
  sendAmount,
  fee,
  feeMAD,
  receiveNetwork,
  receiveAmount,
  isCash,
  clientNom,
  clientPrenom,
  clientEmail,
  receptionAccount,
  receptionRib,
}) {
  const rateLine =
    sendNetwork.currency !== receiveNetwork.currency
      ? `Taux appliqué : ${formatAmount(1, sendNetwork.currency)} = ${formatAmount(
          convertAmount(1, sendNetwork.currency, receiveNetwork.currency),
          receiveNetwork.currency
        )}`
      : null;

  const lines = [
    "*🧾 MoneyBridge — Reçu de commande*",
    "",
    `Référence : ${orderId}`,
    `Client Nº : ${clientPrenom} ${clientNom} #${String(clientNumber).padStart(3, "0")}`,
    `Date : ${date}`,
    "──────────────",
    "",
    "📤 *Envoi*",
    `Réseau : ${sendNetwork.name}`,
    `Montant envoyé : ${formatAmount(sendAmount, sendNetwork.currency)}`,
    "",
    "📥 *Réception*",
    `Réseau : ${receiveNetwork.name}`,
    `Montant à recevoir : ${formatAmount(receiveAmount, receiveNetwork.currency)}`,
  ];
  if (receptionAccount) {
    lines.push(`Numéro de compte (réception) : ${receptionAccount}`);
  }
  if (receptionRib) {
    lines.push(`RIB (réception) : ${receptionRib}`);
  }
  lines.push("", `💰 Frais MoneyBridge : ${formatAmount(feeMAD, "MAD")}`);
  if (rateLine) lines.push(rateLine);
  lines.push("──────────────");
  if (!isCash) {
    lines.push(
      "*📎 Merci d'envoyer une preuve de paiement (capture d'écran ou reçu) juste après ce message.*"
    );
  }
  lines.push(
    "──────────────",
    "Merci de votre confiance. Cette commande sera traitée en moins de 10 minutes."
  );
  return lines.join("\n");
}

export default function MoneyBridge() {
  const [step, setStep] = useState(0);
  const [sendCountryId, setSendCountryId] = useState(null);
  const [sendNetworkId, setSendNetworkId] = useState(null);
  const [sendAmountStr, setSendAmountStr] = useState("");
  const [receiveCountryId, setReceiveCountryId] = useState(null);
  const [receiveNetworkId, setReceiveNetworkId] = useState(null);
  const [clientNom, setClientNom] = useState("");
  const [clientPrenom, setClientPrenom] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [receptionAccount, setReceptionAccount] = useState("");
  const [receptionRib, setReceptionRib] = useState("");

  // Accès admin caché : ajouter #admin à l'URL (ex: monsite.com/#admin).
  // Invisible et inaccessible pour un visiteur normal qui ne connaît pas
  // cette route — aucun lien ni bouton n'y mène depuis le parcours client.
  const [isAdmin, setIsAdmin] = useState(
    typeof window !== "undefined" && window.location.hash === "#admin"
  );
  React.useEffect(() => {
    const onHashChange = () => setIsAdmin(window.location.hash === "#admin");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const sendCountry = COUNTRIES.find((c) => c.id === sendCountryId);
  const receiveCountry = COUNTRIES.find((c) => c.id === receiveCountryId);
  const sendNetworks = sendCountry ? networksForCountry(sendCountry.id) : [];
  const receiveNetworks = receiveCountry ? networksForCountry(receiveCountry.id) : [];
  const sendNetwork = NETWORKS.find((n) => n.id === sendNetworkId);
  const receiveNetwork = NETWORKS.find((n) => n.id === receiveNetworkId);
  const sendAmount = parseFloat(sendAmountStr.replace(",", "."));

  const fee = useMemo(() => {
    if (!sendNetwork || !sendAmount) return 0;
    return computeFee(sendAmount, sendNetwork.currency);
  }, [sendNetwork, sendAmount]);

  // Les frais sont toujours affichés en dirhams (MAD), quelle que soit la
  // devise choisie pour l'envoi.
  const feeMAD = useMemo(() => {
    if (!sendNetwork || !sendAmount) return 0;
    const amountInMAD =
      sendNetwork.currency === "MAD" ? sendAmount : convertAmount(sendAmount, sendNetwork.currency, "MAD");
    return computeFee(amountInMAD, "MAD");
  }, [sendNetwork, sendAmount]);

  const receiveAmount = useMemo(() => {
    if (!sendNetwork || !receiveNetwork || !sendAmount || sendAmount <= 0) return null;
    const net = Math.max(sendAmount - fee, 0);
    return convertAmount(net, sendNetwork.currency, receiveNetwork.currency);
  }, [sendNetwork, receiveNetwork, sendAmount, fee]);

  const minAmount = sendNetwork ? minSendFor(sendNetwork.currency) : null;
  const belowMin = sendNetwork && sendAmount > 0 && sendAmount < minAmount;

  const canGoStep1 = Boolean(sendCountryId);
  const canGoStep2 = sendNetwork && sendAmount > 0 && !belowMin;
  const canGoStep3 = Boolean(receiveCountryId);
  const canGoStep4 = receiveNetwork && receiveAmount !== null;
  const canGoStep5 = Boolean(clientNom.trim() && clientPrenom.trim());
  const receiveAccountDigits = receiveNetwork ? accountDigitsFor(receiveNetwork) : null;
  const canGoStep6 =
    receiveNetwork?.type === "cash" ||
    (receiveNetwork?.type === "mobile" && receptionAccount.length === 10) ||
    (receiveNetwork?.type === "bank" &&
      receptionAccount.length === receiveAccountDigits &&
      receptionRib.length === RIB_DIGITS);
  const canSubmit = Boolean(sendNetwork && receiveNetwork);
  const [orders, setOrders] = useState([]);

  const resetForm = () => {
    setSendCountryId(null);
    setSendNetworkId(null);
    setSendAmountStr("");
    setReceiveCountryId(null);
    setReceiveNetworkId(null);
    setClientNom("");
    setClientPrenom("");
    setClientEmail("");
    setReceptionAccount("");
    setReceptionRib("");
    setStep(0);
  };

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", color: COLORS.textPrimary }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
        .mb-display { font-family: 'Space Grotesk', sans-serif; }
        .mb-body { font-family: 'Inter', sans-serif; }
        .mb-input:focus { outline: 2px solid ${COLORS.gold}; outline-offset: 2px; }
        .mb-btn:focus-visible { outline: 2px solid ${COLORS.gold}; outline-offset: 2px; }
        @keyframes mb-pulse { 0%,100% { opacity: 1; } 50% { opacity: .55; } }
        .mb-pulse { animation: mb-pulse 2.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .mb-pulse { animation: none; } }
      `}</style>

      {isAdmin ? (
        <AdminPanel orders={orders} />
      ) : (
        <div className="max-w-md mx-auto px-5 pt-8 pb-16 mb-body">
        <Header sendNetwork={sendNetwork} receiveNetwork={receiveNetwork} />

        {step > 0 && <StepDots step={step} />}

        {step === 0 && <Welcome onStart={() => setStep(1)} />}

        {step === 1 && (
          <CountryStep
            title="Pays d'envoi"
            subtitle="Depuis quel pays envoyez-vous l'argent ?"
            countries={COUNTRIES}
            selectedId={sendCountryId}
            onSelect={(id) => {
              setSendCountryId(id);
              setSendNetworkId(null);
            }}
            canGoNext={canGoStep1}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}

        {step === 2 && (
          <SendStep
            networks={sendNetworks}
            sendNetworkId={sendNetworkId}
            setSendNetworkId={setSendNetworkId}
            sendAmountStr={sendAmountStr}
            setSendAmountStr={setSendAmountStr}
            sendNetwork={sendNetwork}
            fee={fee}
            feeMAD={feeMAD}
            minAmount={minAmount}
            belowMin={belowMin}
            canGoNext={canGoStep2}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <CountryStep
            title="Pays de réception"
            subtitle="Vers quel pays l'argent doit-il arriver ?"
            countries={COUNTRIES}
            selectedId={receiveCountryId}
            onSelect={(id) => {
              setReceiveCountryId(id);
              setReceiveNetworkId(null);
            }}
            canGoNext={canGoStep3}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && (
          <ReceiveStep
            networks={receiveNetworks}
            receiveNetworkId={receiveNetworkId}
            setReceiveNetworkId={setReceiveNetworkId}
            sendNetwork={sendNetwork}
            sendAmount={sendAmount}
            fee={fee}
            feeMAD={feeMAD}
            receiveNetwork={receiveNetwork}
            receiveAmount={receiveAmount}
            canGoNext={canGoStep4}
            onNext={() => setStep(5)}
            onBack={() => setStep(3)}
          />
        )}

        {step === 5 && (
          <ClientInfoStep
            clientNom={clientNom}
            setClientNom={setClientNom}
            clientPrenom={clientPrenom}
            setClientPrenom={setClientPrenom}
            clientEmail={clientEmail}
            setClientEmail={setClientEmail}
            canGoNext={canGoStep5}
            onNext={() => setStep(6)}
            onBack={() => setStep(4)}
          />
        )}

        {step === 6 && (
          <ReceptionCoordsStep
            receiveNetwork={receiveNetwork}
            receptionAccount={receptionAccount}
            setReceptionAccount={setReceptionAccount}
            receptionRib={receptionRib}
            setReceptionRib={setReceptionRib}
            canGoNext={canGoStep6}
            onNext={() => setStep(7)}
            onBack={() => setStep(5)}
          />
        )}

        {step === 7 && (
          <PaymentStep
            sendCountry={sendCountry}
            sendNetwork={sendNetwork}
            sendAmount={sendAmount}
            fee={fee}
            feeMAD={feeMAD}
            receiveNetwork={receiveNetwork}
            receiveAmount={receiveAmount}
            canSubmit={canSubmit}
            onSubmit={() => {
              const orderId = generateOrderId();
              const date = new Date().toLocaleString("fr-FR");
              const isCash = sendNetwork.id === "cash";
              const clientNumber = orders.length + 1;

              setOrders((prev) => [
                {
                  id: orderId,
                  clientNumber,
                  date,
                  sendCountry,
                  sendNetwork,
                  sendAmount,
                  receiveCountry,
                  receiveNetwork,
                  receiveAmount,
                  feeMAD,
                  isCash,
                  clientNom,
                  clientPrenom,
                  clientEmail,
                  receptionAccount,
                  receptionRib,
                },
                ...prev,
              ]);

              const message = buildWhatsAppMessage({
                orderId,
                clientNumber,
                date,
                sendNetwork,
                sendAmount,
                fee,
                feeMAD,
                receiveNetwork,
                receiveAmount,
                isCash,
                clientNom,
                clientPrenom,
                clientEmail,
                receptionAccount,
                receptionRib,
              });
              window.open(
                `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
                "_blank"
              );
              setStep(8);
            }}
            onBack={() => setStep(6)}
          />
        )}

        {step === 8 && (
          <Confirmation isCash={sendNetwork?.id === "cash"} onNewOrder={resetForm} />
        )}
        </div>
      )}
    </div>
  );
}

function Header({ sendNetwork, receiveNetwork }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: COLORS.gold }}
        >
          <Repeat size={18} color={COLORS.bg} />
        </div>
        <span className="mb-display text-lg font-semibold tracking-tight">
          MoneyBridge
        </span>
      </div>
      {(sendNetwork || receiveNetwork) && (
        <span className="text-[11px]" style={{ color: COLORS.textMuted }}>
          Transfert en cours
        </span>
      )}
    </div>
  );
}

function StepDots({ step }) {
  const labels = [
    "Pays envoi",
    "Réseau envoi",
    "Pays réception",
    "Réseau réception",
    "Mes infos",
    "Réception",
    "Paiement",
  ];
  return (
    <div className="flex items-center gap-1 mb-8">
      {labels.map((label, i) => {
        const idx = i + 1;
        const active = idx === step;
        const done = idx < step;
        return (
          <div key={label} className="flex items-center gap-1 flex-1">
            <div
              className="h-1.5 rounded-full flex-1 transition-all"
              style={{
                background: done || active ? COLORS.gold : COLORS.border,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function Welcome({ onStart }) {
  return (
    <div className="pb-4">
      <div
        className="rounded-3xl p-5 mb-6 relative overflow-hidden"
        style={{
          background: `linear-gradient(145deg, ${COLORS.bgCardAlt}, ${COLORS.bgCard})`,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold mb-5"
          style={{ background: "rgba(31,138,120,0.14)", color: COLORS.goldSoft }}
        >
          <ShieldCheck size={14} />
          Simple · Rapide · Transparent
        </div>

        <div
          className="text-xs tracking-widest uppercase mb-3"
          style={{ color: COLORS.teal, letterSpacing: "0.15em" }}
        >
          MONEYBRIDGE
        </div>

        <h1 className="mb-display text-3xl font-bold leading-tight mb-4">
          Envoyez votre argent là où il doit aller.
        </h1>

        <p className="leading-relaxed mb-5" style={{ color: COLORS.textMuted }}>
          Maroc, Côte d'Ivoire, Gabon et bientôt bien plus.
        </p>

        <p className="text-sm leading-relaxed mb-6" style={{ color: COLORS.textPrimary }}>
          Envoyez et recevez votre argent à travers plusieurs pays et réseaux,
          depuis une seule plateforme, en quelques étapes.
        </p>

        <button
          onClick={onStart}
          className="mb-btn mb-display w-full py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2"
          style={{ background: COLORS.gold, color: COLORS.bg }}
        >
          Commencer un transfert <ArrowRight size={18} />
        </button>
      </div>

      <div className="mb-7" id="how-it-works">
        <h2 className="mb-display text-xl font-semibold mb-1">Comment ça marche ?</h2>
        <p className="text-sm mb-4" style={{ color: COLORS.textMuted }}>
          Quelques étapes pour envoyer votre argent.
        </p>

        <div
          className="rounded-2xl p-4 space-y-4"
          style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}` }}
        >
          <HowItWorksRow
            icon={ArrowRight}
            title="1. Choisissez le pays d'envoi"
            text="Indiquez le pays depuis lequel l'argent part."
          />
          <HowItWorksRow
            icon={Smartphone}
            title="2. Choisissez le réseau d'envoi"
            text="Les réseaux disponibles s'adaptent automatiquement au pays."
          />
          <HowItWorksRow
            icon={ArrowRight}
            title="3. Choisissez le pays de réception"
            text="Sélectionnez le pays dans lequel l'argent doit arriver."
          />
          <HowItWorksRow
            icon={Smartphone}
            title="4. Choisissez le réseau de réception"
            text="Sélectionnez la banque ou le mobile money du bénéficiaire."
          />
          <HowItWorksRow
            icon={Banknote}
            title="5. Indiquez le montant"
            text="Le montant reçu et les frais sont calculés automatiquement."
          />
          <HowItWorksRow
            icon={CheckCircle2}
            title="6. Confirmez votre demande"
            text="Effectuez le paiement puis envoyez votre preuve sur WhatsApp."
          />
        </div>
      </div>

      <Footer />
    </div>
  );
}

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="mt-8 pt-6 text-center"
      style={{ borderTop: `1px solid ${COLORS.border}` }}
    >
      <div className="mb-display font-semibold mb-2">MoneyBridge</div>
      <p className="text-xs leading-relaxed mb-4" style={{ color: COLORS.textMuted }}>
        Transferts d'argent entre le Maroc et l'Afrique.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs mb-4">
        <span style={{ color: COLORS.textMuted }}>À propos de nous</span>
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}`}
          target="_blank"
          rel="noreferrer"
          style={{ color: COLORS.goldSoft }}
        >
          Contactez-nous
        </a>
        <a href="#how-it-works" style={{ color: COLORS.textMuted }}>
          Comment ça marche ?
        </a>
        <span style={{ color: COLORS.textMuted }}>Conditions</span>
        <span style={{ color: COLORS.textMuted }}>Confidentialité</span>
      </div>
      <div className="text-[11px]" style={{ color: COLORS.textMuted }}>
        © {year} MoneyBridge — Tous droits réservés.
      </div>
    </footer>
  );
}

function HowItWorksRow({ icon: Icon, title, text }) {
  return (
    <div className="flex gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: COLORS.bgCardAlt }}
      >
        <Icon size={15} color={COLORS.goldSoft} />
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
          {text}
        </div>
      </div>
    </div>
  );
}

function CountryPicker({ countries, selectedId, onSelect }) {
  return (
    <div className="space-y-2.5">
      {countries.map((c) => {
        const active = selectedId === c.id;
        const count = networksForCountry(c.id).length;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="mb-btn w-full rounded-2xl p-4 flex items-center justify-between text-left"
            style={{
              background: active ? "rgba(201,162,39,0.12)" : COLORS.bgCard,
              border: `1.5px solid ${active ? COLORS.gold : COLORS.border}`,
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{c.flag}</span>
              <div>
                <div className="text-sm font-semibold">{c.name}</div>
                <div className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
                  {count} réseau{count > 1 ? "x" : ""} disponible{count > 1 ? "s" : ""} · {c.currency}
                </div>
              </div>
            </div>
            {active && <CheckCircle2 size={19} color={COLORS.goldSoft} />}
          </button>
        );
      })}
    </div>
  );
}

function CountryStep({ title, subtitle, countries, selectedId, onSelect, canGoNext, onNext, onBack }) {
  return (
    <div>
      <h2 className="mb-display text-xl font-semibold mb-1">{title}</h2>
      <p className="text-sm mb-5" style={{ color: COLORS.textMuted }}>
        {subtitle}
      </p>

      <CountryPicker countries={countries} selectedId={selectedId} onSelect={onSelect} />

      <div className="flex gap-2.5 mt-7">
        <button
          onClick={onBack}
          className="mb-btn mb-display py-3.5 px-4 rounded-xl font-semibold flex items-center justify-center"
          style={{ background: COLORS.bgCard, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
        >
          <ArrowLeft size={18} />
        </button>
        <button
          onClick={onNext}
          disabled={!canGoNext}
          className="mb-btn mb-display flex-1 py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2"
          style={{
            background: canGoNext ? COLORS.gold : COLORS.border,
            color: canGoNext ? COLORS.bg : COLORS.textMuted,
          }}
        >
          Suivant <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function NetworkPicker({ networks, selectedId, onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {networks.map((n) => {
        const Icon = n.icon;
        const active = selectedId === n.id;
        return (
          <button
            key={n.id}
            onClick={() => onSelect(n.id)}
            className="mb-btn rounded-xl p-3 text-left transition-all"
            style={{
              background: active ? "rgba(201,162,39,0.12)" : COLORS.bgCard,
              border: `1.5px solid ${active ? COLORS.gold : COLORS.border}`,
            }}
          >
            <Icon size={18} color={active ? COLORS.goldSoft : COLORS.textMuted} />
            <div className="text-sm font-semibold mt-2">{n.name}</div>
            <div className="text-xs" style={{ color: COLORS.textMuted }}>
              {n.currency}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SendStep({
  networks,
  sendNetworkId,
  setSendNetworkId,
  sendAmountStr,
  setSendAmountStr,
  sendNetwork,
  fee,
  feeMAD,
  minAmount,
  belowMin,
  canGoNext,
  onNext,
  onBack,
}) {
  return (
    <div>
      <h2 className="mb-display text-xl font-semibold mb-1">J'envoie</h2>
      <p className="text-sm mb-5" style={{ color: COLORS.textMuted }}>
        Choisissez le réseau depuis lequel vous envoyez l'argent.
      </p>

      <NetworkPicker networks={networks} selectedId={sendNetworkId} onSelect={setSendNetworkId} />

      {sendNetwork && (
        <div
          className="mt-4 rounded-xl px-4 py-3 flex items-start gap-2.5 text-sm"
          style={{ background: "rgba(201,162,39,0.10)", border: `1px solid ${COLORS.gold}` }}
        >
          <ShieldCheck size={16} color={COLORS.goldSoft} className="mt-0.5 shrink-0" />
          <span>
            Montant minimum pour cet envoi :{" "}
            <strong>{formatAmount(minAmount, sendNetwork.currency)}</strong>
            {sendNetwork.currency !== "MAD"
              ? ""
              : ` (soit ${MIN_SEND_CFA.toLocaleString("fr-FR")} CFA)`}
          </span>
        </div>
      )}

      <div className="mt-6">
        <label className="text-xs uppercase tracking-wide mb-2 block" style={{ color: COLORS.textMuted }}>
          Montant à envoyer {sendNetwork ? `(${sendNetwork.currency})` : ""}
        </label>
        <input
          className="mb-input w-full rounded-xl px-4 py-3 text-lg mb-display font-semibold"
          style={{
            background: COLORS.bgCard,
            border: `1.5px solid ${belowMin ? COLORS.danger : COLORS.border}`,
            color: COLORS.textPrimary,
          }}
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={sendAmountStr}
          onChange={(e) => setSendAmountStr(e.target.value.replace(/[^0-9.,]/g, ""))}
        />
        {belowMin && (
          <div className="text-xs mt-1.5" style={{ color: COLORS.danger }}>
            Le montant minimum est de {formatAmount(minAmount, sendNetwork.currency)}
          </div>
        )}
      </div>

      {sendNetwork && sendAmountStr && (
        <div
          className="mt-3 rounded-xl px-4 py-3 flex items-center justify-between text-sm"
          style={{ background: COLORS.bgCardAlt, border: `1px solid ${COLORS.border}` }}
        >
          <span style={{ color: COLORS.textMuted }}>Frais MoneyBridge</span>
          <span className="font-semibold">{formatAmount(feeMAD, "MAD")}</span>
        </div>
      )}

      <div className="flex gap-2.5 mt-7">
        <button
          onClick={onBack}
          className="mb-btn mb-display py-3.5 px-4 rounded-xl font-semibold flex items-center justify-center"
          style={{ background: COLORS.bgCard, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
        >
          <ArrowLeft size={18} />
        </button>
        <button
          onClick={onNext}
          disabled={!canGoNext}
          className="mb-btn mb-display flex-1 py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2"
          style={{
            background: canGoNext ? COLORS.gold : COLORS.border,
            color: canGoNext ? COLORS.bg : COLORS.textMuted,
          }}
        >
          Suivant <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function ReceiveStep({
  networks,
  receiveNetworkId,
  setReceiveNetworkId,
  sendNetwork,
  sendAmount,
  fee,
  feeMAD,
  receiveNetwork,
  receiveAmount,
  canGoNext,
  onNext,
  onBack,
}) {
  return (
    <div>
      <h2 className="mb-display text-xl font-semibold mb-1">Je reçois</h2>
      <p className="text-sm mb-5" style={{ color: COLORS.textMuted }}>
        Choisissez le réseau qui recevra l'argent.
      </p>

      <NetworkPicker networks={networks} selectedId={receiveNetworkId} onSelect={setReceiveNetworkId} />

      <div
        className="mt-6 rounded-xl p-4 space-y-2.5"
        style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}` }}
      >
        <Row label="Vous payez" value={formatAmount(sendAmount, sendNetwork.currency)} />
        <Row label="Frais (déduits)" value={formatAmount(feeMAD, "MAD")} />
        <div style={{ borderTop: `1px solid ${COLORS.border}` }} className="pt-2.5">
          <Row
            label="Montant reçu estimé"
            value={
              receiveAmount !== null
                ? formatAmount(receiveAmount, receiveNetwork.currency)
                : "—"
            }
            emphasize
          />
        </div>
        {receiveNetwork && sendNetwork.currency !== receiveNetwork.currency && (
          <div className="text-xs" style={{ color: COLORS.textMuted }}>
            Taux appliqué : 1 {sendNetwork.currency} ={" "}
            {convertAmount(1, sendNetwork.currency, receiveNetwork.currency).toLocaleString(
              "fr-FR",
              { maximumFractionDigits: 4 }
            )}{" "}
            {receiveNetwork.currency}
          </div>
        )}
      </div>

      <div className="flex gap-2.5 mt-7">
        <button
          onClick={onBack}
          className="mb-btn mb-display py-3.5 px-4 rounded-xl font-semibold flex items-center justify-center"
          style={{ background: COLORS.bgCard, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
        >
          <ArrowLeft size={18} />
        </button>
        <button
          onClick={onNext}
          disabled={!canGoNext}
          className="mb-btn mb-display flex-1 py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2"
          style={{
            background: canGoNext ? COLORS.gold : COLORS.border,
            color: canGoNext ? COLORS.bg : COLORS.textMuted,
          }}
        >
          Suivant <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, emphasize }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: COLORS.textMuted }}>
        {label}
      </span>
      <span
        className={emphasize ? "mb-display text-lg font-bold" : "text-sm font-semibold"}
        style={{ color: emphasize ? COLORS.goldSoft : COLORS.textPrimary }}
      >
        {value}
      </span>
    </div>
  );
}

function ClientInfoStep({
  clientNom,
  setClientNom,
  clientPrenom,
  setClientPrenom,
  clientEmail,
  setClientEmail,
  canGoNext,
  onNext,
  onBack,
}) {
  return (
    <div>
      <h2 className="mb-display text-xl font-semibold mb-1">Mes coordonnées</h2>
      <p className="text-sm mb-5" style={{ color: COLORS.textMuted }}>
        Ces informations permettent de vous identifier pour le suivi de votre
        demande.
      </p>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          <ClientField placeholder="Nom" value={clientNom} onChange={setClientNom} />
          <ClientField placeholder="Prénom" value={clientPrenom} onChange={setClientPrenom} />
        </div>
        <ClientField
          placeholder="Adresse mail (optionnel)"
          value={clientEmail}
          onChange={setClientEmail}
          type="email"
        />
      </div>

      <div className="flex gap-2.5 mt-7">
        <button
          onClick={onBack}
          className="mb-btn mb-display py-3.5 px-4 rounded-xl font-semibold flex items-center justify-center"
          style={{ background: COLORS.bgCard, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
        >
          <ArrowLeft size={18} />
        </button>
        <button
          onClick={onNext}
          disabled={!canGoNext}
          className="mb-btn mb-display flex-1 py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2"
          style={{
            background: canGoNext ? COLORS.gold : COLORS.border,
            color: canGoNext ? COLORS.bg : COLORS.textMuted,
          }}
        >
          Suivant <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function ReceptionCoordsStep({
  receiveNetwork,
  receptionAccount,
  setReceptionAccount,
  receptionRib,
  setReceptionRib,
  canGoNext,
  onNext,
  onBack,
}) {
  const isCash = receiveNetwork.type === "cash";
  const isBank = receiveNetwork.type === "bank";
  const accountDigits = accountDigitsFor(receiveNetwork);

  return (
    <div>
      <h2 className="mb-display text-xl font-semibold mb-1">Coordonnées de réception</h2>
      <p className="text-sm mb-5" style={{ color: COLORS.textMuted }}>
        {isCash
          ? "Vous récupérerez l'argent en espèces, aucune coordonnée n'est nécessaire ici."
          : `Indiquez où l'argent doit arriver sur ${receiveNetwork.name}.`}
      </p>

      {isCash ? (
        <div
          className="rounded-xl p-4"
          style={{ background: COLORS.bgCard, border: `1px dashed ${COLORS.border}` }}
        >
          <span className="text-sm" style={{ color: COLORS.textMuted }}>
            Un agent MoneyBridge vous contactera pour organiser la remise.
          </span>
        </div>
      ) : isBank ? (
        <div className="space-y-3">
          <DigitField
            placeholder="Numéro de compte"
            value={receptionAccount}
            onChange={setReceptionAccount}
            maxDigits={accountDigits}
          />
          <DigitField
            placeholder="RIB"
            value={receptionRib}
            onChange={setReceptionRib}
            maxDigits={RIB_DIGITS}
          />
        </div>
      ) : (
        <DigitField
          placeholder="Numéro de téléphone (réception)"
          value={receptionAccount}
          onChange={setReceptionAccount}
          maxDigits={10}
        />
      )}

      <div className="flex gap-2.5 mt-7">
        <button
          onClick={onBack}
          className="mb-btn mb-display py-3.5 px-4 rounded-xl font-semibold flex items-center justify-center"
          style={{ background: COLORS.bgCard, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
        >
          <ArrowLeft size={18} />
        </button>
        <button
          onClick={onNext}
          disabled={!canGoNext}
          className="mb-btn mb-display flex-1 py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2"
          style={{
            background: canGoNext ? COLORS.gold : COLORS.border,
            color: canGoNext ? COLORS.bg : COLORS.textMuted,
          }}
        >
          Suivant <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function PaymentStep({
  sendCountry,
  sendNetwork,
  sendAmount,
  fee,
  feeMAD,
  canSubmit,
  onSubmit,
  onBack,
}) {
  const info = PAY_INFO[sendNetwork.id];
  const isCash = sendNetwork.id === "cash";

  // Les vraies coordonnées Orange Money / WAVE ne sont configurées que pour
  // la Côte d'Ivoire. Pour tout autre pays partageant ce même réseau
  // (ex: Burkina Faso), on affiche "à convenir avec un agent" même si le
  // réseau a par ailleurs de vraies coordonnées pour la Côte d'Ivoire.
  const isSharedNetworkOutsideCI =
    sendCountry && sendCountry.id !== "ci" && sendNetwork.countries.includes("ci");
  const displayNote = isSharedNetworkOutsideCI
    ? "À convenir avec un agent MoneyBridge après votre demande"
    : info.note;

  return (
    <div>
      <h2 className="mb-display text-xl font-semibold mb-1">Paiement</h2>
      <p className="text-sm mb-1" style={{ color: COLORS.textMuted }}>
        {displayNote
          ? `Préparez ${formatAmount(sendAmount, sendNetwork.currency)}. Un agent MoneyBridge vous contactera pour la suite.`
          : `Envoyez ${formatAmount(sendAmount, sendNetwork.currency)} vers les coordonnées ${sendNetwork.name} ci-dessous.`}
      </p>
      <p className="text-xs mb-5" style={{ color: COLORS.textMuted }}>
        Frais MoneyBridge inclus : {formatAmount(feeMAD, "MAD")} (déjà déduits du montant reçu).
      </p>

      {displayNote ? (
        <div
          className="rounded-xl p-4 mb-5"
          style={{ background: COLORS.bgCard, border: `1.5px solid ${COLORS.gold}` }}
        >
          <div className="text-xs uppercase tracking-wide mb-1" style={{ color: COLORS.textMuted }}>
            {isCash ? "Point de dépôt espèces" : sendNetwork.name}
          </div>
          <div className="text-sm font-semibold">{displayNote}</div>
        </div>
      ) : (
        <div
          className="rounded-xl p-4 mb-5 space-y-3"
          style={{ background: COLORS.bgCard, border: `1.5px solid ${COLORS.gold}` }}
        >
          <PayInfoRow label="Nom" value={info.nom} />
          <PayInfoRow label="Prénom" value={info.prenom} />
          <PayInfoRow label="Numéro de compte" value={info.numeroCompte} />
          {info.rib && <PayInfoRow label="RIB" value={info.rib} />}
        </div>
      )}

      <p className="text-xs mt-3" style={{ color: COLORS.textMuted }}>
        {isCash
          ? "En cliquant sur « Confirmer », WhatsApp s'ouvre avec un message pré-rempli récapitulant votre demande. Aucune preuve n'est nécessaire pour un paiement en espèces."
          : "En cliquant sur « J'ai payé », WhatsApp s'ouvre avec un message pré-rempli récapitulant votre transaction — il vous sera demandé d'y joindre votre preuve de paiement juste après."}
      </p>

      <div className="flex gap-2.5 mt-6">
        <button
          onClick={onBack}
          className="mb-btn mb-display py-3.5 px-4 rounded-xl font-semibold flex items-center justify-center"
          style={{ background: COLORS.bgCard, color: COLORS.textPrimary, border: `1px solid ${COLORS.border}` }}
        >
          <ArrowLeft size={18} />
        </button>
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="mb-btn mb-display flex-1 py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2"
          style={{
            background: canSubmit ? COLORS.gold : COLORS.border,
            color: canSubmit ? COLORS.bg : COLORS.textMuted,
          }}
        >
          {isCash ? "Confirmer" : "J'ai payé"} <CheckCircle2 size={18} />
        </button>
      </div>
    </div>
  );
}

function PayInfoRow({ label, value }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide mb-0.5" style={{ color: COLORS.textMuted }}>
        {label}
      </div>
      <div className="mb-display text-base font-bold break-all">{value}</div>
    </div>
  );
}

function ClientField({ placeholder, value, onChange, type = "text" }) {
  return (
    <input
      className="mb-input w-full rounded-xl px-4 py-3 text-sm font-semibold"
      style={{
        background: COLORS.bgCard,
        border: `1.5px solid ${COLORS.border}`,
        color: COLORS.textPrimary,
      }}
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// Champ numérique qui n'accepte que des chiffres, limité à un nombre exact
// de caractères, avec un compteur et un retour visuel si incomplet.
function DigitField({ placeholder, value, onChange, maxDigits }) {
  const complete = value.length === maxDigits;
  const showError = value.length > 0 && !complete;
  return (
    <div>
      <input
        className="mb-input w-full rounded-xl px-4 py-3 text-sm font-semibold"
        style={{
          background: COLORS.bgCard,
          border: `1.5px solid ${showError ? COLORS.danger : complete ? COLORS.teal : COLORS.border}`,
          color: COLORS.textPrimary,
        }}
        type="tel"
        inputMode="numeric"
        placeholder={`${placeholder} (${maxDigits} chiffres)`}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, maxDigits))}
      />
      <div
        className="text-xs mt-1.5"
        style={{ color: showError ? COLORS.danger : COLORS.textMuted }}
      >
        {value.length}/{maxDigits} chiffres
      </div>
    </div>
  );
}

function Confirmation({ isCash, onNewOrder }) {
  return (
    <div className="flex flex-col items-center text-center pt-10">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
        style={{ background: "rgba(31,138,120,0.15)" }}
      >
        <CheckCircle2 size={32} color={COLORS.teal} />
      </div>
      <h2 className="mb-display text-2xl font-bold mb-2">Demande envoyée avec succès</h2>
      <p className="text-sm mb-6 leading-relaxed" style={{ color: COLORS.textMuted }}>
        Votre demande a été envoyée avec succès et sera traitée en moins de 10
        minutes.
      </p>
      <div
        className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
        style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}` }}
      >
        <Clock size={16} color={COLORS.goldSoft} />
        Traitement estimé : moins de 10 minutes
      </div>
      <p className="text-xs mt-5 leading-relaxed" style={{ color: COLORS.textMuted }}>
        {isCash
          ? "Un onglet WhatsApp s'est ouvert avec le récapitulatif. Un agent MoneyBridge va vous recontacter pour organiser la remise en espèces."
          : "Un onglet WhatsApp s'est ouvert avec le récapitulatif. Pensez à y envoyer votre capture de paiement si ce n'est pas déjà fait."}
      </p>
      <button
        onClick={onNewOrder}
        className="mb-btn mb-display w-full py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2 mt-7"
        style={{ background: COLORS.gold, color: COLORS.bg }}
      >
        Nouvelle demande <ArrowRight size={18} />
      </button>
    </div>
  );
}

function AdminPanel({ orders }) {
  const totalFeesMAD = orders.reduce((sum, o) => sum + (o.feeMAD || 0), 0);

  return (
    <div className="max-w-2xl mx-auto px-5 pt-8 pb-16 mb-body">
      <div className="flex items-center justify-between mb-1">
        <h1 className="mb-display text-2xl font-bold">Commandes — Admin</h1>
        <span
          className="text-xs px-2.5 py-1 rounded-full font-semibold"
          style={{ background: COLORS.bgCardAlt, color: COLORS.goldSoft }}
        >
          {orders.length} commande{orders.length > 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-sm mb-6" style={{ color: COLORS.textMuted }}>
        Vue interne, accessible uniquement via l'URL secrète #admin. Aucun
        lien vers cette page n'existe dans le parcours client. Les preuves de
        paiement arrivent directement sur WhatsApp, pas dans cette liste.
      </p>

      <div
        className="rounded-xl p-4 mb-6 flex items-center justify-between"
        style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}` }}
      >
        <span className="text-sm" style={{ color: COLORS.textMuted }}>
          Total des frais collectés (session en cours)
        </span>
        <span className="mb-display text-lg font-bold" style={{ color: COLORS.goldSoft }}>
          {formatAmount(totalFeesMAD, "MAD")}
        </span>
      </div>

      {orders.length === 0 ? (
        <div
          className="rounded-xl p-6 text-center text-sm"
          style={{ background: COLORS.bgCard, border: `1px dashed ${COLORS.border}`, color: COLORS.textMuted }}
        >
          Aucune commande pour l'instant dans cette session.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="rounded-xl p-4"
              style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}` }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="mb-display font-bold text-sm">{o.id}</span>
                <span className="text-xs" style={{ color: COLORS.textMuted }}>
                  {o.date}
                </span>
              </div>
              <div className="text-xs mb-2" style={{ color: COLORS.goldSoft }}>
                {o.clientPrenom} {o.clientNom} #{String(o.clientNumber).padStart(3, "0")}
                {o.clientEmail ? ` · ${o.clientEmail}` : ""}
                {o.receptionAccount ? ` · Réception : ${o.receptionAccount}` : ""}
                {o.receptionRib ? ` (RIB ${o.receptionRib})` : ""}
              </div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span style={{ color: COLORS.textMuted }}>
                  Envoi · {o.sendCountry?.name} · {o.sendNetwork.name}
                </span>
                <span className="font-semibold">
                  {formatAmount(o.sendAmount, o.sendNetwork.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span style={{ color: COLORS.textMuted }}>
                  Réception · {o.receiveCountry?.name} · {o.receiveNetwork.name}
                </span>
                <span className="font-semibold">
                  {formatAmount(o.receiveAmount, o.receiveNetwork.currency)}
                </span>
              </div>
              <div
                className="flex items-center justify-between text-xs mt-2 pt-2"
                style={{ borderTop: `1px solid ${COLORS.border}` }}
              >
                <span style={{ color: COLORS.textMuted }}>
                  Frais : {formatAmount(o.feeMAD, "MAD")}
                </span>
                {o.isCash ? (
                  <span style={{ color: COLORS.textMuted }}>Paiement en espèces</span>
                ) : (
                  <span className="flex items-center gap-1" style={{ color: COLORS.goldSoft }}>
                    <FileText size={13} /> Preuve attendue sur WhatsApp
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
