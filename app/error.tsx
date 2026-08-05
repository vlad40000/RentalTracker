"use client";
export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){return <main className="auth-wrap"><section className="auth-card"><div className="eyebrow">Request failed</div><h1>The operation did not complete.</h1><p className="muted">{error.message}</p><button className="button" onClick={reset}>Try again</button></section></main>}
