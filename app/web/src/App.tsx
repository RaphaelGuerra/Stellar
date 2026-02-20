import { useState } from "react";
import { useLocation, Switch, Route } from "wouter";
import { useAppContext, toDaylightSavingValue, parseDaylightSavingValue } from "./context/AppContext";
import { ModeToggle } from "./components/ModeToggle";
import { Section } from "./components/Section";
import { PersonForm } from "./components/PersonForm";
import { AstralMapModal } from "./components/AstralMapModal";
import { HOUSE_SYSTEMS } from "./lib/constants";
import type { ChartSettings } from "./lib/types";
import { ChartView } from "./views/ChartView";
import { TransitsView } from "./views/TransitsView";
import { TimingView } from "./views/TimingView";
import { RelationshipsView } from "./views/RelationshipsView";
import { AtlasView } from "./views/AtlasView";
import { LibraryView } from "./views/LibraryView";

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    mode, setMode, isCarioca,
    analysisMode, setAnalysisMode,
    duoMode, setDuoMode,
    chartSettings, setChartSettings,
    chartA, chartB,
    loading, error, setError,
    exportMessage,
    history,
    persistLocalData, setPersistLocalData,
    isMapModalOpen, setIsMapModalOpen,
    astralMapModel, chartMeta, resultVersion,
    sharedImportInputRef, reportExportRef,
    showShootingStar, appStateRetentionDays,
    handleGenerateChart, handleLoadHistory, handleClearLocalData,
    handleExportJson, handleExportReportPng, handleExportReportPdf,
    handleOpenSharedImport, handleSharedImportFile,
    dateA, setDateA, timeA, setTimeA, daylightSavingA, setDaylightSavingA,
    showDaylightSavingOverrideA, geoA, kbA,
    dateB, setDateB, timeB, setTimeB, daylightSavingB, setDaylightSavingB,
    showDaylightSavingOverrideB, geoB, kbB,
  } = useAppContext();

  const [location, navigate] = useLocation();
  const defaultArea = analysisMode === "compatibility" ? "relationships" : "chart";
  const rawArea = location.replace(/^\//, "");
  const VALID_AREAS = ["chart", "transits", "timing", "relationships", "atlas", "library"] as const;
  const isValidArea = rawArea !== "" && (VALID_AREAS as readonly string[]).includes(rawArea);
  const isRelationshipsInSingle = rawArea === "relationships" && analysisMode === "single";
  const primaryArea = isValidArea && !isRelationshipsInSingle
    ? rawArea as typeof VALID_AREAS[number]
    : defaultArea as typeof VALID_AREAS[number];

  const t = {
    modeLabel: isCarioca ? "Carioca raiz, porra" : "English",
    headerTagline: isCarioca
      ? "\"Rio no peito, estrelas no olhar, brilhando pra caralho.\""
      : "\"City of stars, are you shining just for me?\"",
    areaChart: isCarioca ? "Mapa" : "Chart",
    areaTransits: isCarioca ? "Transitos" : "Transits",
    areaTiming: isCarioca ? "Timing" : "Timing",
    areaRelationships: isCarioca ? "Relacoes" : "Relationships",
    areaAtlas: isCarioca ? "Atlas" : "Atlas",
    areaLibrary: isCarioca ? "Biblioteca" : "Library",
    settingsTitle: isCarioca ? "Calibra esse mapa ai" : "Chart settings",
    settingsHouseSystem: isCarioca ? "Sistema de casas" : "House system",
    settingsAspectProfile: isCarioca ? "Perfil de aspectos" : "Aspect profile",
    settingsOrbMode: isCarioca ? "Modo de orb" : "Orb mode",
    settingsMinorAspects: isCarioca ? "Bota os aspectos menores tambem" : "Include minor aspects",
    settingsAspectMajor: isCarioca ? "So os grandao" : "Major",
    settingsAspectExpanded: isCarioca ? "Tudo junto e misturado" : "Expanded",
    orbStandard: isCarioca ? "Padrao" : "Standard",
    orbTight: isCarioca ? "Apertadinho" : "Tight",
    orbWide: isCarioca ? "Largadao" : "Wide",
    singleMode: isCarioca ? "Mapa solo, cria" : "Single chart",
    compatibilityMode: isCarioca ? "Sinastria braba" : "Compatibility",
    personA: isCarioca ? "Tu (Pessoa A)" : "Person A",
    personB: isCarioca ? "O outro (Pessoa B)" : "Person B",
    generating: isCarioca ? "Calculando essa porra toda..." : "Generating...",
    generateNew: isCarioca ? "Bora de novo, caralho" : "New chart",
    generate: isCarioca ? "Gerar mapa, porra!" : "Generate chart",
    error: isCarioca ? "Puta merda, deu ruim" : "Error generating chart",
    duoModeRomantic: isCarioca ? "Pegacao" : "Romantic",
    duoModeFriend: isCarioca ? "Parceria" : "Friend",
    historyTitle: isCarioca ? "Mapas ja gerados" : "Saved history",
    historyLoad: isCarioca ? "Abre ai" : "Load",
    exportJson: isCarioca ? "Exportar JSON" : "Export JSON",
    exportReportPng: isCarioca ? "Salvar PNG bonito" : "Export PNG report",
    exportReportPdf: isCarioca ? "Salvar PDF maneiro" : "Export PDF report",
    importSharedJson: isCarioca ? "Importar perfil do parceiro" : "Import shared profile",
    historySingle: isCarioca ? "Solo" : "Single",
    historyCompatibility: isCarioca ? "Sinastria" : "Compatibility",
    privacyTitle: isCarioca ? "Privacidade local" : "Local privacy",
    privacyPersist: isCarioca ? "Guardar os dados nesse aparelho" : "Save data on this device",
    privacyHint: (days: number) =>
      isCarioca
        ? `Relaxa, os dados somem sozinhos em ${days} dias.`
        : `Local data expires automatically after ${days} days.`,
    privacyDisabledHint: isCarioca ? "Nao ta salvando nada local, suave." : "Local persistence is disabled.",
    privacyClear: isCarioca ? "Apagar tudo agora, foda-se" : "Clear local data now",
    astralMapModalTitle: isCarioca ? "Mapa astral em HD, porra" : "Full-resolution astral map",
    astralMapClose: isCarioca ? "Fecha" : "Close",
    astralMapDownloadPng: isCarioca ? "Baixar PNG" : "Download PNG",
    astralMapDownloadPdf: isCarioca ? "Baixar PDF" : "Download PDF",
    astralMapDownloadDonePng: isCarioca ? "PNG salvo, ta na mao!" : "PNG downloaded successfully.",
    astralMapDownloadDonePdf: isCarioca ? "PDF salvo, show de bola!" : "PDF downloaded successfully.",
    astralMapDownloadError: isCarioca ? "Deu merda no download, tenta de novo." : "Could not generate file.",
    astralMapFilters: isCarioca ? "Filtro de aspectos" : "Aspect filters",
    astralMapAllAspects: isCarioca ? "Todos" : "All",
    astralMapLegendOuterA: isCarioca ? "anel externo" : "outer ring",
    astralMapLegendInnerB: isCarioca ? "anel interno" : "inner ring",
    astralMapLegendFlow: isCarioca ? "fluxo" : "flow",
    astralMapLegendTension: isCarioca ? "tensao" : "tension",
    astralMapLegendIntense: isCarioca ? "intenso" : "intense",
  };

  const ariaLabels = {
    chartInfo: isCarioca ? "Dados atuais do mapa" : "Current chart info",
    chartGenerator: isCarioca ? "Gerador de mapa astral" : "Birth chart generator",
    birthDataForm: isCarioca ? "Dados de nascimento" : "Birth data form",
    analysisMode: isCarioca ? "Modo de analise" : "Analysis mode",
    contentMode: isCarioca ? "Idioma" : "Content mode",
    duoMode: isCarioca ? "Tipo de relacao" : "Duo mode",
    privacyControls: isCarioca ? "Privacidade" : "Local privacy controls",
    primaryArea: isCarioca ? "Area principal" : "Primary area",
  };

  const formLabels = {
    date: isCarioca ? "Nascimento" : "Date",
    time: isCarioca ? "Hora" : "Time",
    cityAndCountry: isCarioca ? "Onde tu nasceu, maluco" : "City & country",
    searchPlaceholder: isCarioca ? "São Paulo, SP, Brasil" : "São Paulo, SP, Brasil",
    searching: isCarioca ? "Procurando essa porra..." : "Searching cities...",
    noResults: isCarioca ? "Nao achei porra nenhuma, confere ai." : "No cities found.",
    cityHint: "",
    datePickerDialog: isCarioca ? "Escolher data" : "Choose date",
    datePickerYear: isCarioca ? "Ano" : "Year",
    datePickerPreviousMonth: isCarioca ? "Mes anterior" : "Previous month",
    datePickerNextMonth: isCarioca ? "Proximo mes" : "Next month",
    daylightSaving: isCarioca ? "Horario de verao" : "Daylight saving",
    daylightSavingAuto: isCarioca ? "Auto (deixa comigo)" : "Auto (recommended)",
    daylightSavingManual: isCarioca ? "Mexer no horario de verao na mao" : "Manual daylight saving override",
    daylightSavingManualHint: isCarioca
      ? "Deixa no auto, caralho. So mexe se o horario de nascimento ficou duplicado por causa do relogio."
      : "Keep Auto for most cases. Use manual only when a birth time is duplicated by DST fallback.",
    yes: isCarioca ? "Sim, porra" : "Yes",
    no: isCarioca ? "Nao, caralho" : "No",
    hour: isCarioca ? "Hora" : "Hour",
    minute: isCarioca ? "Minuto" : "Minute",
    datePlaceholder: isCarioca ? "10 de jun. de 1998" : "Jun 10, 1998",
    timePlaceholder: "08:34",
    cityPlaceholder: "São Paulo, SP, Brasil",
  };

  const hasResults =
    (analysisMode === "single" && chartA != null) ||
    (analysisMode === "compatibility" && chartA != null && chartB != null);

  const allAreas = [
    { key: "relationships" as const, label: t.areaRelationships, compatOnly: true },
    { key: "chart" as const, label: t.areaChart, compatOnly: false },
    { key: "transits" as const, label: t.areaTransits, compatOnly: false },
    { key: "timing" as const, label: t.areaTiming, compatOnly: false },
    { key: "atlas" as const, label: t.areaAtlas, compatOnly: false },
    { key: "library" as const, label: t.areaLibrary, compatOnly: false },
  ];
  const primaryAreas = allAreas.filter(
    (a) => !a.compatOnly || analysisMode === "compatibility"
  );

  return (
    <>
      <div className="starfield" aria-hidden="true">
        <div className="starfield__layer starfield__layer--1" />
        <div className="starfield__layer starfield__layer--2" />
        <div className="starfield__layer starfield__layer--3" />
        {isCarioca && <div className="starfield__layer starfield__layer--carioca" />}
        {isCarioca && <div className="carioca-orb carioca-orb--sunset" />}
        {isCarioca && <div className="carioca-orb carioca-orb--ocean" />}
        {isCarioca && <div className="carioca-ribbon" />}
        {showShootingStar && <div className="shooting-star" />}
      </div>
      <div className="app" data-content-mode={mode}>
        <div className="container">
          <header className="header" role="banner">
            <div className="header__brand">
              <h1 className="header__title">Stellar</h1>
              <p className="header__tagline">{t.headerTagline}</p>
              <div className="header__meta" aria-label={ariaLabels.chartInfo} aria-live="polite" aria-atomic="true">
                <span>{t.modeLabel}</span>
                {chartMeta && (
                  <>
                    <span className="header__meta-divider" />
                    <span>{chartMeta.location}</span>
                    <span className="header__meta-divider" />
                    <span>{chartMeta.datetime}</span>
                  </>
                )}
              </div>
            </div>
            <ModeToggle mode={mode} setMode={setMode} ariaLabel={ariaLabels.contentMode} />
          </header>

          <main role="main" aria-label={ariaLabels.chartGenerator} ref={reportExportRef}>
            <section className={`action-section ${hasResults ? "action-section--compact" : ""}`}>
              <form className="form" onSubmit={handleGenerateChart} aria-label={ariaLabels.birthDataForm}>
                <div className="analysis-mode" role="group" aria-label={ariaLabels.analysisMode}>
                  <button
                    type="button"
                    className={`analysis-mode__btn ${analysisMode === "single" ? "analysis-mode__btn--active" : ""}`}
                    onClick={() => {
                      setError(null);
                      setAnalysisMode("single");
                      if (primaryArea === "relationships") navigate("/chart");
                    }}
                  >
                    {t.singleMode}
                  </button>
                  <button
                    type="button"
                    className={`analysis-mode__btn ${analysisMode === "compatibility" ? "analysis-mode__btn--active" : ""}`}
                    onClick={() => {
                      setError(null);
                      setAnalysisMode("compatibility");
                      navigate("/relationships");
                    }}
                  >
                    {t.compatibilityMode}
                  </button>
                </div>

                <details
                  className="settings-panel"
                  open={settingsOpen}
                  onToggle={(e) => setSettingsOpen(e.currentTarget.open)}
                >
                  <summary className="settings-panel__summary"><span className="collapsible-chevron" aria-hidden="true" />{t.settingsTitle}</summary>
                  <div className="privacy-controls" role="group" aria-label={t.settingsTitle}>
                    <label className="privacy-controls__toggle">
                      <span>{t.settingsHouseSystem}</span>
                      <select
                        value={chartSettings.houseSystem}
                        onChange={(event) =>
                          setChartSettings((current) => ({
                            ...current,
                            houseSystem: event.target.value as ChartSettings["houseSystem"],
                          }))
                        }
                      >
                        {HOUSE_SYSTEMS.map((system) => (
                          <option key={system} value={system}>{system}</option>
                        ))}
                      </select>
                    </label>
                    <label className="privacy-controls__toggle">
                      <span>{t.settingsAspectProfile}</span>
                      <select
                        value={chartSettings.aspectProfile}
                        onChange={(event) =>
                          setChartSettings((current) => ({
                            ...current,
                            aspectProfile: event.target.value as ChartSettings["aspectProfile"],
                          }))
                        }
                      >
                        <option value="major">{t.settingsAspectMajor}</option>
                        <option value="expanded">{t.settingsAspectExpanded}</option>
                      </select>
                    </label>
                    <label className="privacy-controls__toggle">
                      <span>{t.settingsOrbMode}</span>
                      <select
                        value={chartSettings.orbMode}
                        onChange={(event) =>
                          setChartSettings((current) => ({
                            ...current,
                            orbMode: event.target.value as ChartSettings["orbMode"],
                          }))
                        }
                      >
                        <option value="standard">{t.orbStandard}</option>
                        <option value="tight">{t.orbTight}</option>
                        <option value="wide">{t.orbWide}</option>
                      </select>
                    </label>
                    <label className="privacy-controls__toggle">
                      <input
                        type="checkbox"
                        checked={chartSettings.includeMinorAspects}
                        onChange={(event) =>
                          setChartSettings((current) => ({
                            ...current,
                            includeMinorAspects: event.target.checked,
                          }))
                        }
                      />
                      <span>{t.settingsMinorAspects}</span>
                    </label>
                  </div>
                </details>

                {analysisMode === "compatibility" && (
                  <div className="duo-mode" role="group" aria-label={ariaLabels.duoMode}>
                    <button
                      type="button"
                      className={`duo-mode__btn ${duoMode === "romantic" ? "duo-mode__btn--active" : ""}`}
                      data-duo="romantic"
                      onClick={() => setDuoMode("romantic")}
                    >
                      {t.duoModeRomantic}
                    </button>
                    <button
                      type="button"
                      className={`duo-mode__btn ${duoMode === "friend" ? "duo-mode__btn--active" : ""}`}
                      data-duo="friend"
                      onClick={() => setDuoMode("friend")}
                    >
                      {t.duoModeFriend}
                    </button>
                  </div>
                )}

                <PersonForm
                  title={analysisMode === "compatibility" ? t.personA : undefined}
                  framed={analysisMode === "compatibility"}
                  locale={isCarioca ? "pt-BR" : "en-US"}
                  date={dateA}
                  time={timeA}
                  daylightSavingValue={toDaylightSavingValue(daylightSavingA)}
                  onDateChange={setDateA}
                  onTimeChange={setTimeA}
                  onDaylightSavingChange={(v) => setDaylightSavingA(parseDaylightSavingValue(v))}
                  geo={geoA}
                  labels={formLabels}
                  hintId="city-hint-a"
                  suggestionsId="city-suggestions-a"
                  namePrefix="birth"
                  activeIndex={kbA.activeIndex}
                  onKeyDown={kbA.onKeyDown}
                  showDaylightSavingOverride={showDaylightSavingOverrideA}
                />

                {analysisMode === "single" && (
                  <div className="form__row form__row--actions">
                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading ? t.generating : chartA ? t.generateNew : t.generate}
                    </button>
                  </div>
                )}

                {analysisMode === "compatibility" && (
                  <>
                    <PersonForm
                      title={t.personB}
                      framed
                      locale={isCarioca ? "pt-BR" : "en-US"}
                      date={dateB}
                      time={timeB}
                      daylightSavingValue={toDaylightSavingValue(daylightSavingB)}
                      onDateChange={setDateB}
                      onTimeChange={setTimeB}
                      onDaylightSavingChange={(v) => setDaylightSavingB(parseDaylightSavingValue(v))}
                      geo={geoB}
                      labels={formLabels}
                      hintId="city-hint-b"
                      suggestionsId="city-suggestions-b"
                      namePrefix="birth-b"
                      activeIndex={kbB.activeIndex}
                      onKeyDown={kbB.onKeyDown}
                      showDaylightSavingOverride={showDaylightSavingOverrideB}
                    />
                    <div className="form__row form__row--actions">
                      <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? t.generating : chartA && chartB ? t.generateNew : t.generate}
                      </button>
                    </div>
                  </>
                )}

                <div className="form__row form__row--actions">
                  <button type="button" className="btn-ghost" onClick={handleOpenSharedImport}>
                    {t.importSharedJson}
                  </button>
                  {hasResults && (
                    <>
                      <button type="button" className="btn-ghost" onClick={handleExportJson}>
                        {t.exportJson}
                      </button>
                      <button type="button" className="btn-ghost" onClick={handleExportReportPng}>
                        {t.exportReportPng}
                      </button>
                      <button type="button" className="btn-ghost" onClick={handleExportReportPdf}>
                        {t.exportReportPdf}
                      </button>
                    </>
                  )}
                  <input
                    ref={sharedImportInputRef}
                    type="file"
                    accept="application/json"
                    onChange={handleSharedImportFile}
                    style={{ display: "none" }}
                  />
                </div>
                {exportMessage && <p className="privacy-controls__hint">{exportMessage}</p>}

                {error && (
                  <p className="form__error" role="alert">
                    {t.error}: {error}
                  </p>
                )}
              </form>
            </section>

            <nav className="primary-nav" aria-label={ariaLabels.primaryArea}>
              {primaryAreas.map((area) => (
                <button
                  key={area.key}
                  type="button"
                  className={`primary-nav__btn ${primaryArea === area.key ? "primary-nav__btn--active" : ""}`}
                  onClick={() => navigate("/" + area.key)}
                >
                  {area.label}
                </button>
              ))}
            </nav>

            <Switch>
              <Route path="/chart" component={ChartView} />
              <Route path="/transits" component={TransitsView} />
              <Route path="/timing" component={TimingView} />
              <Route path="/relationships" component={RelationshipsView} />
              <Route path="/atlas" component={AtlasView} />
              <Route path="/library" component={LibraryView} />
              <Route component={analysisMode === "compatibility" ? RelationshipsView : ChartView} />
            </Switch>

            <section className="action-section action-section--compact">
              <details className="settings-panel">
                <summary className="settings-panel__summary"><span className="collapsible-chevron" aria-hidden="true" />{t.privacyTitle}</summary>
                <div className="privacy-controls" role="group" aria-label={ariaLabels.privacyControls}>
                  <label className="privacy-controls__toggle">
                    <input
                      type="checkbox"
                      checked={persistLocalData}
                      onChange={(event) => setPersistLocalData(event.target.checked)}
                    />
                    <span>{t.privacyPersist}</span>
                  </label>
                  <p className="privacy-controls__hint">
                    {persistLocalData ? t.privacyHint(appStateRetentionDays) : t.privacyDisabledHint}
                  </p>
                  <button type="button" className="privacy-controls__clear" onClick={handleClearLocalData}>
                    {t.privacyClear}
                  </button>
                </div>
              </details>
            </section>

            {!loading && history.length > 0 && (
              <Section icon="🗂️" title={t.historyTitle} badge={`${history.length}`} collapsible defaultOpen={false}>
                <div className="history-list">
                  {history.map((entry) => {
                    const when = new Date(entry.createdAt);
                    const modeLabel =
                      entry.analysisMode === "compatibility"
                        ? `${t.historyCompatibility} · ${entry.duoMode === "friend" ? t.duoModeFriend : t.duoModeRomantic}`
                        : t.historySingle;
                    const cities =
                      entry.analysisMode === "compatibility" && entry.chartB
                        ? `${entry.chartA.input.city} + ${entry.chartB.input.city}`
                        : entry.chartA.input.city;
                    return (
                      <div key={entry.id} className="history-item">
                        <div className="history-item__meta">
                          <p className="history-item__title">{cities}</p>
                          <p className="history-item__subtitle">
                            {modeLabel} · {when.toLocaleString(isCarioca ? "pt-BR" : "en-US")}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="history-item__load"
                          onClick={() => handleLoadHistory(entry)}
                        >
                          {t.historyLoad}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}
          </main>
        </div>
        <AstralMapModal
          key={`${analysisMode}-${resultVersion}-${isMapModalOpen ? "open" : "closed"}`}
          isOpen={isMapModalOpen}
          model={astralMapModel}
          title={t.astralMapModalTitle}
          onClose={() => setIsMapModalOpen(false)}
          labels={{
            close: t.astralMapClose,
            downloadPng: t.astralMapDownloadPng,
            downloadPdf: t.astralMapDownloadPdf,
            downloadDonePng: t.astralMapDownloadDonePng,
            downloadDonePdf: t.astralMapDownloadDonePdf,
            downloadError: t.astralMapDownloadError,
            filters: t.astralMapFilters,
            allAspects: t.astralMapAllAspects,
            legendOuterA: t.astralMapLegendOuterA,
            legendInnerB: t.astralMapLegendInnerB,
            legendFlow: t.astralMapLegendFlow,
            legendTension: t.astralMapLegendTension,
            legendIntense: t.astralMapLegendIntense,
          }}
        />
      </div>
    </>
  );
}

export default App;
