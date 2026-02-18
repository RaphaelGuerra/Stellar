import { useLocation, Switch, Route } from "wouter";
import { useAppContext, toDaylightSavingValue, parseDaylightSavingValue } from "./context/AppContext";
import { ModeToggle } from "./components/ModeToggle";
import { Section } from "./components/Section";
import { PersonForm } from "./components/PersonForm";
import { AstralMapModal } from "./components/AstralMapModal";
import { HOUSE_SYSTEMS } from "./lib/constants";
import { SUPPORTED_CITIES } from "./lib/resolveCity";
import type { ChartSettings } from "./lib/types";
import { ChartView } from "./views/ChartView";
import { TransitsView } from "./views/TransitsView";
import { TimingView } from "./views/TimingView";
import { RelationshipsView } from "./views/RelationshipsView";
import { AtlasView } from "./views/AtlasView";
import { LibraryView } from "./views/LibraryView";

function App() {
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
  const rawArea = location.replace(/^\//, "") || "chart";
  const VALID_AREAS = ["chart", "transits", "timing", "relationships", "atlas", "library"] as const;
  const primaryArea = (VALID_AREAS as readonly string[]).includes(rawArea)
    ? rawArea as typeof VALID_AREAS[number]
    : "chart";

  const t = {
    modeLabel: isCarioca ? "Carioca raiz, porra" : "English",
    headerTagline: isCarioca
      ? "\"Rio no peito, estrelas no olhar, brilhando pra Stella.\""
      : "\"City of stars, are you shining just for me?\"",
    headerDedication: isCarioca ? "Feito com amor pra Stella" : "Made with love for Stella",
    areaChart: isCarioca ? "Mapa" : "Chart",
    areaTransits: isCarioca ? "Transitos" : "Transits",
    areaTiming: isCarioca ? "Timing" : "Timing",
    areaRelationships: isCarioca ? "Relacoes" : "Relationships",
    areaAtlas: isCarioca ? "Atlas" : "Atlas",
    areaLibrary: isCarioca ? "Biblioteca" : "Library",
    settingsTitle: isCarioca ? "Configuracoes do mapa" : "Chart settings",
    settingsHouseSystem: isCarioca ? "Sistema de casas" : "House system",
    settingsAspectProfile: isCarioca ? "Perfil de aspectos" : "Aspect profile",
    settingsOrbMode: isCarioca ? "Modo de orb" : "Orb mode",
    settingsMinorAspects: isCarioca ? "Incluir aspectos menores" : "Include minor aspects",
    settingsAspectMajor: isCarioca ? "Maiores" : "Major",
    settingsAspectExpanded: isCarioca ? "Expandido" : "Expanded",
    orbStandard: isCarioca ? "Padrao" : "Standard",
    orbTight: isCarioca ? "Apertado" : "Tight",
    orbWide: isCarioca ? "Amplo" : "Wide",
    singleMode: isCarioca ? "Mapa solo bolado" : "Single chart",
    compatibilityMode: isCarioca ? "Sinastria braba" : "Compatibility",
    personA: isCarioca ? "Pessoa A (tu)" : "Person A",
    personB: isCarioca ? "Pessoa B (o outro)" : "Person B",
    generating: isCarioca ? "Gerando essa porra..." : "Generating...",
    generateNew: isCarioca ? "Gerar outro mapa, caralho" : "New chart",
    generate: isCarioca ? "Gerar mapa, porra" : "Generate chart",
    error: isCarioca ? "Deu merda no mapa" : "Error generating chart",
    duoModeRomantic: isCarioca ? "Romantico" : "Romantic",
    duoModeFriend: isCarioca ? "Amizade" : "Friend",
    historyTitle: isCarioca ? "Historico salvo" : "Saved history",
    historyLoad: isCarioca ? "Carregar" : "Load",
    exportJson: isCarioca ? "Exportar JSON" : "Export JSON",
    exportReportPng: isCarioca ? "Exportar PNG (relatorio)" : "Export PNG report",
    exportReportPdf: isCarioca ? "Exportar PDF (relatorio)" : "Export PDF report",
    importSharedJson: isCarioca ? "Importar perfil compartilhado" : "Import shared profile",
    historySingle: isCarioca ? "Solo" : "Single",
    historyCompatibility: isCarioca ? "Sinastria" : "Compatibility",
    privacyTitle: isCarioca ? "Privacidade local" : "Local privacy",
    privacyPersist: isCarioca ? "Salvar dados neste dispositivo" : "Save data on this device",
    privacyHint: (days: number) =>
      isCarioca
        ? `Dados locais expiram automaticamente em ${days} dias.`
        : `Local data expires automatically after ${days} days.`,
    privacyDisabledHint: isCarioca ? "Salvamento local desligado." : "Local persistence is disabled.",
    privacyClear: isCarioca ? "Limpar dados locais agora" : "Clear local data now",
    astralMapModalTitle: isCarioca ? "Mapa astral em alta resolucao" : "Full-resolution astral map",
    astralMapClose: isCarioca ? "Fechar" : "Close",
    astralMapDownloadPng: isCarioca ? "Baixar PNG" : "Download PNG",
    astralMapDownloadPdf: isCarioca ? "Baixar PDF" : "Download PDF",
    astralMapDownloadDonePng: isCarioca ? "PNG baixado com sucesso." : "PNG downloaded successfully.",
    astralMapDownloadDonePdf: isCarioca ? "PDF baixado com sucesso." : "PDF downloaded successfully.",
    astralMapDownloadError: isCarioca ? "Nao foi possivel gerar o arquivo." : "Could not generate file.",
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
    birthDataForm: isCarioca ? "Formulario de dados de nascimento" : "Birth data form",
    analysisMode: isCarioca ? "Modo de analise" : "Analysis mode",
    contentMode: isCarioca ? "Modo de conteudo" : "Content mode",
    duoMode: isCarioca ? "Modo de dupla" : "Duo mode",
    privacyControls: isCarioca ? "Controles de privacidade local" : "Local privacy controls",
    primaryArea: isCarioca ? "Area principal" : "Primary area",
  };

  const formLabels = {
    date: isCarioca ? "Data" : "Date",
    time: isCarioca ? "Hora" : "Time",
    cityAndCountry: isCarioca ? "Cidade e pais, sem caozada" : "City & country",
    searchPlaceholder: isCarioca ? "Ex: Rio de Janeiro, BR" : "e.g. New York, US",
    searching: isCarioca ? "Caçando cidade..." : "Searching cities...",
    noResults: isCarioca ? "Nao achei porra nenhuma." : "No cities found.",
    cityHint: isCarioca
      ? `Manda a cidade com pais certinho, mermão. Ou usa um exemplo: ${SUPPORTED_CITIES.join(", ")}`
      : `Type to search cities worldwide or try: ${SUPPORTED_CITIES.join(", ")}`,
    datePickerDialog: isCarioca ? "Escolher data" : "Choose date",
    datePickerYear: isCarioca ? "Ano" : "Year",
    datePickerPreviousMonth: isCarioca ? "Mes anterior" : "Previous month",
    datePickerNextMonth: isCarioca ? "Proximo mes" : "Next month",
    daylightSaving: isCarioca ? "Horario de verao" : "Daylight saving",
    daylightSavingAuto: isCarioca ? "Auto (recomendado)" : "Auto (recommended)",
    daylightSavingManual: isCarioca ? "Ajuste manual de horario de verao" : "Manual daylight saving override",
    daylightSavingManualHint: isCarioca
      ? "Deixa no auto na maior parte dos casos. So abre isso se o horario nascer duplicado."
      : "Keep Auto for most cases. Use manual only when a birth time is duplicated by DST fallback.",
    yes: isCarioca ? "Sim, porra" : "Yes",
    no: isCarioca ? "Nao, porra" : "No",
  };

  const hasResults =
    (analysisMode === "single" && chartA != null) ||
    (analysisMode === "compatibility" && chartA != null && chartB != null);

  const primaryAreas = [
    { key: "chart" as const, label: t.areaChart },
    { key: "transits" as const, label: t.areaTransits },
    { key: "timing" as const, label: t.areaTiming },
    { key: "relationships" as const, label: t.areaRelationships },
    { key: "atlas" as const, label: t.areaAtlas },
    { key: "library" as const, label: t.areaLibrary },
  ];

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
              <p className="header__dedication">{t.headerDedication}</p>
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
                    onClick={() => { setError(null); setAnalysisMode("single"); }}
                  >
                    {t.singleMode}
                  </button>
                  <button
                    type="button"
                    className={`analysis-mode__btn ${analysisMode === "compatibility" ? "analysis-mode__btn--active" : ""}`}
                    onClick={() => { setError(null); setAnalysisMode("compatibility"); }}
                  >
                    {t.compatibilityMode}
                  </button>
                </div>

                <div className="privacy-controls" role="group" aria-label={t.settingsTitle}>
                  <p className="privacy-controls__title">{t.settingsTitle}</p>
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
                <div className="analysis-mode" role="group" aria-label={ariaLabels.primaryArea}>
                  {primaryAreas.map((area) => (
                    <button
                      key={area.key}
                      type="button"
                      className={`analysis-mode__btn ${primaryArea === area.key ? "analysis-mode__btn--active" : ""}`}
                      onClick={() => navigate("/" + area.key)}
                    >
                      {area.label}
                    </button>
                  ))}
                </div>

                {error && (
                  <p className="form__error" role="alert">
                    {t.error}: {error}
                  </p>
                )}
              </form>
            </section>

            <Switch>
              <Route path="/chart" component={ChartView} />
              <Route path="/transits" component={TransitsView} />
              <Route path="/timing" component={TimingView} />
              <Route path="/relationships" component={RelationshipsView} />
              <Route path="/atlas" component={AtlasView} />
              <Route path="/library" component={LibraryView} />
              <Route component={ChartView} />
            </Switch>

            <section className="action-section action-section--compact">
              <div className="privacy-controls" role="group" aria-label={ariaLabels.privacyControls}>
                <p className="privacy-controls__title">{t.privacyTitle}</p>
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
            </section>

            {!loading && history.length > 0 && (
              <Section icon="🗂️" title={t.historyTitle} badge={`${history.length}`}>
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
