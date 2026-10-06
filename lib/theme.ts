export const THEME_KEY = "jeopardy_theme";

/** Runs before hydration so the saved theme is applied without a flash. */
export const themeInitScript = `try{if(localStorage.getItem("${THEME_KEY}")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;
