"use client";

export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  return <main className="auth-wrap"><section className="auth-card">
    <div className="eyebrow">Request failed</div>
    <h1>The demo could not complete that request.</h1>
    <p className="muted">No financial record was deleted or overwritten. Try the request once more.</p>
    {error.digest&&<p className="muted" style={{fontSize:12}}>Error reference: {error.digest}</p>}
    <button className="button" onClick={reset}>Try again</button>
  </section></main>;
}
