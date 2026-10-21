import{a as P,c as $e}from"./chunk-2CDOMDGA.js";import{C as z,H as _e}from"./chunk-JAQKBYME.js";import{a as C,b as W,c as Y,d as ye}from"./chunk-3YCF2ESS.js";import{a as d,d as pe}from"./chunk-YAYVMLV2.js";import{b as q,c as j,d as we}from"./chunk-LM6RPF4Z.js";import{d as v,e as fe}from"./chunk-C6HRAGLJ.js";import{c as k,d as be,i as t,l as ve,r as N,s as V,u as ge}from"./chunk-2YN6OJ2T.js";import{a,b as ue,c as me}from"./chunk-BY6I6UVC.js";async function J(e){return v(`/api/users/${encodeURIComponent(e)}/profile`)}async function K(e,o){let i={bio:e};return o!==void 0&&(i.industry=o),v("/api/users/me/profile",{method:"PUT",body:i})}async function G(e,o){return v("/api/me/password",{method:"POST",body:{old_password:e,new_password:o}})}async function Q(e,o){return v(`/api/users/${encodeURIComponent(e)}/recommendations`,{method:"POST",body:{content:o}})}async function X(e){return v(`/api/users/${encodeURIComponent(e)}/block`,{method:"POST"})}async function Z(e){return v(`/api/users/${encodeURIComponent(e)}/block`,{method:"DELETE"})}async function ee(e){return v(`/api/users/${encodeURIComponent(e)}/follow`,{method:"POST"})}async function te(e){return v(`/api/users/${encodeURIComponent(e)}/follow`,{method:"DELETE"})}async function oe(e,o=20,i=0){let n=new URLSearchParams({limit:String(o),offset:String(i)});return v(`/api/users/${encodeURIComponent(e)}/followers?${n.toString()}`)}async function ne(e,o=20,i=0){let n=new URLSearchParams({limit:String(o),offset:String(i)});return v(`/api/users/${encodeURIComponent(e)}/following?${n.toString()}`)}var ie=ue(()=>{fe();a(J,"fetchUserProfile");a(K,"updateMyProfile");a(G,"changePassword");a(Q,"upsertRecommendation");a(X,"blockUser");a(Z,"unblockUser");a(ee,"followUser");a(te,"unfollowUser");a(oe,"fetchFollowers");a(ne,"fetchFollowing")});var Re=me(()=>{ie();_e();ye();be();pe();$e();ge();we();ve();var E=d("profileWelcome"),Ee=d("profileCard"),se=d("profileBioPanel"),re=d("profileFollowPanel"),he=d("profileRecommendationPanel"),le="",B="",I=!1,xe="",h="followers",M=null;q();j();function Le(){return new URLSearchParams(window.location.search).get("user_id")}a(Le,"getUserId");function g(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}a(g,"escapeHtml");async function ke(){let{response:e,data:o}=await C();if(!e.ok){window.location.href="/login.html";return}le=o.user_id,B=o.email||"",I=!!o.email_verified,V(o)}a(ke,"loadCurrentUser");function H(e){let o=k(e.username,e.icon_url,120),i=e.is_me&&e.email?`<div class="profile-meta-line profile-email-line"><span class="profile-meta-label">${t("profile.email")}</span><a class="profile-email-link" href="mailto:${g(e.email)}">${g(e.email)}</a></div>`:"",n=!e.is_me&&!e.i_blocked_user&&!e.blocked_me,s=e.i_blocked_user?t("profile.youBlockedUser"):e.blocked_me?t("profile.userBlockedYou"):"",b=n?`<a class="btn-inline btn-secondary" href="/chat.html?user_id=${encodeURIComponent(e.user_id)}&username=${encodeURIComponent(e.username)}">${t("profile.sendMessage")}</a>`:"",r=!e.is_me&&!e.i_blocked_user&&!e.blocked_me?`<button id="profileFollowBtn" class="btn-inline ${e.is_following?"btn-secondary":"btn-primary"}" type="button">${e.is_following?t("profile.unfollowUser"):t("profile.followUser")}</button>`:"",l=e.is_me?"":`<button id="profileBlockBtn" class="btn-inline btn-secondary" type="button">${e.i_blocked_user?t("profile.unblockUser"):t("profile.blockUser")}</button>`,u=e.follower_count??0,y=e.following_count??0,D=`
    <div class="profile-meta-line profile-follow-summary">
      <span class="profile-follow-count"><strong>${u}</strong> ${t("profile.followersLabel")}</span>
      <span class="profile-follow-count"><strong>${y}</strong> ${t("profile.followingLabel")}</span>
      ${e.followed_me?`<span class="tag-chip">${t("profile.followsYou")}</span>`:""}
    </div>
  `,_=s?`<div class="status-text">${g(s)}</div>`:"";if(Ee.innerHTML=`
    <div class="profile-hero">
      <img class="profile-hero-avatar" src="${o}" alt="${e.username}" />
      <div class="profile-hero-body">
        <div class="badge">${e.is_me?t("profile.myProfile"):t("profile.userProfile")}</div>
        <h2>${e.username}</h2>
        ${i}
        <div class="profile-meta-line">${t("profile.userId",{id:e.user_id})}</div>
        <div class="profile-meta-line">${t("profile.joinedAt",{time:P(e.created_at)})}</div>
        ${D}
        <div class="task-form-actions">${b}${r}${l}</div>
        ${_}
      </div>
    </div>
  `,e.is_me)return;let w=document.getElementById("profileFollowBtn");w?.addEventListener("click",async()=>{w.disabled=!0;let m=e.is_following?await te(e.user_id):await ee(e.user_id);if(!m.response.ok||!m.data.profile){E.textContent=m.data.error||t("profile.followActionFailed"),w.disabled=!1;return}E.textContent=m.data.message||"";let p=m.data.profile;H(p),F(p),U(p),A(p)});let f=d("profileBlockBtn");f.addEventListener("click",async()=>{f.disabled=!0;let m=e.i_blocked_user?await Z(e.user_id):await X(e.user_id);if(!m.response.ok||!m.data.profile){E.textContent=m.data.error||t("profile.blockActionFailed"),f.disabled=!1;return}E.textContent=m.data.message||"";let p=m.data.profile;H(p),F(p),U(p),A(p)})}a(H,"renderProfileCard");function Be(e){return e.length?e.map(o=>{let i=k(o.username,o.user_icon,40),n=o.bio?`<div class="reply-meta">${g(o.bio)}</div>`:"",s=o.is_following?`<span class="tag-chip">${t("profile.followingLabel")}</span>`:"";return`
        <div class="profile-recommendation-item">
          <div class="task-applicant-head">
            <a href="/profile.html?user_id=${encodeURIComponent(o.id)}">
              <img class="avatar-xs" src="${i}" alt="${g(o.username)}" />
            </a>
            <div>
              <a class="post-author-name" href="/profile.html?user_id=${encodeURIComponent(o.id)}">${g(o.username)}</a>
              ${n}
            </div>
            ${s}
          </div>
        </div>
      `}).join(""):`<div class='reply-empty'>${t(h==="followers"?"profile.noFollowers":"profile.noFollowing")}</div>`}a(Be,"renderFollowUserList");async function ae(){if(!M)return;let e=document.getElementById("profileFollowList");if(!e)return;e.innerHTML=`<div class='reply-empty'>${t("profile.loadingFollowList")}</div>`;let o=M.user_id,i=h==="followers"?oe:ne,{response:n,data:s}=await i(o,30,0);if(!n.ok){e.innerHTML=`<div class='reply-empty'>${t("profile.followListLoadFailed")}</div>`;return}e.innerHTML=Be(s.users||[])}a(ae,"loadFollowList");function U(e){M=e;let o=e.follower_count??0,i=e.following_count??0;re.innerHTML=`
    <div class="badge">${t("profile.followSection")}</div>
    <div class="lp-filter-bar" style="margin-top:8px;">
      <button class="btn-inline btn-secondary profile-follow-tab ${h==="followers"?"active":""}" data-follow-tab="followers" type="button">${t("profile.tabFollowers",{count:String(o)})}</button>
      <button class="btn-inline btn-secondary profile-follow-tab ${h==="following"?"active":""}" data-follow-tab="following" type="button">${t("profile.tabFollowing",{count:String(i)})}</button>
    </div>
    <div id="profileFollowList" class="task-result-list" style="margin-top:8px;"></div>
  `,re.querySelectorAll(".profile-follow-tab").forEach(n=>{n.addEventListener("click",async()=>{let s=n.dataset.followTab||"followers";s!==h&&(h=s,U(e),await ae())})}),ae()}a(U,"renderFollowPanel");function F(e){if(e.is_me){let o=I?t("profile.emailVerified"):t("profile.emailUnverified"),i=I?"":`<button id="profileSendVerificationBtn" class="btn-inline btn-secondary" type="button">${t("profile.sendVerificationEmail")}</button>`;se.innerHTML=`
      <div class="badge">${t("profile.bio")}</div>
      <div class="profile-verification-card">
        <div class="profile-meta-line"><span class="profile-meta-label">${t("profile.email")}</span><span>${g(B||t("profile.emailUnavailable"))}</span></div>
        <div class="profile-meta-line"><span class="profile-meta-label">${t("profile.emailVerificationStatus")}</span><span>${o}</span></div>
        <div id="profileEmailVerificationStatus" class="status-text"></div>
        <div class="task-form-actions">
          ${i}
        </div>
      </div>
      <form id="profileBioForm" class="task-result-form">
        <label class="form-label" for="profileBioInput">${t("profile.personalBio")}</label>
        <textarea id="profileBioInput" class="input textarea" rows="5" maxlength="500" placeholder="${t("profile.bioPlaceholder")}">${g(e.bio||"")}</textarea>
        <label class="form-label" for="profileIndustryInput">\u884C\u4E1A / \u9886\u57DF <span style="color:var(--text-muted); font-weight:normal; font-size:11px;">\uFF08\u53EF\u9009 \u2014 \u7528\u4E8E AI \u4EFB\u52A1\u4F18\u5316\u65F6\u6CE8\u5165\u9886\u57DF\u4E0A\u4E0B\u6587\uFF09</span></label>
        <input id="profileIndustryInput" class="input" type="text" maxlength="80" list="profileIndustryOptions" value="${g(e.industry||"")}" placeholder="\u4F8B\u5982\uFF1AiOS \u5E94\u7528\u5F00\u53D1\u3001\u91CF\u5316\u91D1\u878D\u3001\u4E34\u5E8A\u7814\u7A76\u3001\u6559\u80B2\u79D1\u6280" />
        <datalist id="profileIndustryOptions">
          <option value="iOS \u5E94\u7528\u5F00\u53D1"></option>
          <option value="Web \u5168\u6808\u5F00\u53D1"></option>
          <option value="\u91CF\u5316\u91D1\u878D"></option>
          <option value="\u533B\u7597 / \u4E34\u5E8A\u7814\u7A76"></option>
          <option value="\u6CD5\u5F8B / \u5408\u89C4"></option>
          <option value="\u79D1\u7814 / \u6570\u636E\u5206\u6790"></option>
          <option value="\u589E\u957F / \u8425\u9500\u8FD0\u8425"></option>
          <option value="\u6559\u80B2\u79D1\u6280"></option>
        </datalist>
        <label class="form-label" for="profileIconInput">${t("profile.avatar")}</label>
        <input id="profileIconInput" class="input" type="file" accept="image/*" />
        <div id="profileBioStatus" class="status-text"></div>
        <div class="task-form-actions">
          <button class="btn-inline btn-secondary" type="submit">${t("profile.saveProfile")}</button>
          <button id="profileBioRefineBtn" class="btn-inline btn-secondary" type="button" title="\u7528 AI \u5E2E\u6211\u6539\u5199">\u2728 AI \u6539\u5199</button>
        </div>
      </form>
      <form id="profilePasswordForm" class="task-result-form" style="margin-top:18px;">
        <div class="badge">\u4FEE\u6539\u5BC6\u7801</div>
        <label class="form-label" for="pwOld">\u5F53\u524D\u5BC6\u7801</label>
        <input id="pwOld" class="input" type="password" autocomplete="current-password" />
        <label class="form-label" for="pwNew">\u65B0\u5BC6\u7801 <span style="color:var(--text-muted); font-weight:normal; font-size:11px;">\uFF08\u81F3\u5C11 6 \u4F4D\uFF09</span></label>
        <input id="pwNew" class="input" type="password" autocomplete="new-password" minlength="6" />
        <label class="form-label" for="pwNew2">\u786E\u8BA4\u65B0\u5BC6\u7801</label>
        <input id="pwNew2" class="input" type="password" autocomplete="new-password" minlength="6" />
        <div id="pwStatus" class="status-text"></div>
        <div class="task-form-actions">
          <button class="btn-inline btn-secondary" type="submit">\u66F4\u65B0\u5BC6\u7801</button>
        </div>
      </form>
    `;let n=d("profilePasswordForm"),s=d("pwStatus");n.addEventListener("submit",async _=>{_.preventDefault();let w=d("pwOld").value,f=d("pwNew").value,m=d("pwNew2").value;if(s.classList.remove("status-success","status-error"),f.length<6){s.textContent="\u65B0\u5BC6\u7801\u81F3\u5C11 6 \u4F4D",s.classList.add("status-error");return}if(f!==m){s.textContent="\u4E24\u6B21\u65B0\u5BC6\u7801\u4E0D\u4E00\u81F4",s.classList.add("status-error");return}if(w===f){s.textContent="\u65B0\u5BC6\u7801\u4E0D\u80FD\u4E0E\u5F53\u524D\u5BC6\u7801\u76F8\u540C",s.classList.add("status-error");return}s.textContent="\u66F4\u65B0\u4E2D\u2026";let{response:p,data:x}=await G(w,f);if(!p.ok){s.textContent=p.status===401?"\u5F53\u524D\u5BC6\u7801\u4E0D\u6B63\u786E":x?.error||"\u66F4\u65B0\u5931\u8D25",s.classList.add("status-error");return}n.reset(),s.textContent=x?.message||"\u5BC6\u7801\u5DF2\u66F4\u65B0 \u2713",s.classList.add("status-success")});let b=d("profileBioForm"),c=d("profileBioInput"),r=d("profileIconInput"),l=d("profileBioStatus"),u=d("profileEmailVerificationStatus"),y=document.getElementById("profileSendVerificationBtn");document.getElementById("profileBioRefineBtn")?.addEventListener("click",()=>{Te(c)}),y?.addEventListener("click",async()=>{y.disabled=!0,u.textContent=t("profile.sendingVerificationEmail");let{response:_,data:w}=await Y();if(!_.ok){u.textContent=w.error||t("profile.emailVerificationSendFailed"),u.classList.remove("status-success"),u.classList.add("status-error"),y.disabled=!1;return}let f=await C();f.response.ok&&(B=f.data.email||B,I=!!f.data.email_verified),u.textContent=w.message||t("profile.verificationEmailSent"),u.classList.remove("status-error"),u.classList.add("status-success"),await T()}),b.addEventListener("submit",async _=>{_.preventDefault(),l.textContent=t("profile.saving");let f=document.getElementById("profileIndustryInput")?.value.trim()??void 0,{response:m,data:p}=await K(c.value.trim(),f);if(!m.ok){l.textContent=p.error||t("profile.saveFailed");return}let x=r.files?.[0];if(x){let O=new FormData;O.append("icon",x);let{response:ce,data:de}=await z(O);if(!ce.ok){l.textContent=de.error||t("profile.avatarUploadFailed");return}}l.textContent=t("profile.profileUpdated"),await T()});return}se.innerHTML=`
    <div class="badge">${t("profile.bio")}</div>
    <div class="profile-bio-copy">${e.bio?g(e.bio):t("profile.noBio")}</div>
  `}a(F,"renderBioPanel");function A(e){let o=e.recommendations||[],i=e.can_recommend&&!e.i_blocked_user&&!e.blocked_me?`
      <form id="recommendationForm" class="task-result-form">
        <label class="form-label" for="recommendationInput">${t("profile.writeRecommendation")}</label>
        <textarea id="recommendationInput" class="input textarea" rows="4" maxlength="1000" placeholder="${t("profile.recommendationPlaceholder")}"></textarea>
        <div id="recommendationStatus" class="status-text"></div>
        <div class="task-form-actions">
          <button class="btn-inline btn-secondary" type="submit">${t("profile.submitRecommendation")}</button>
        </div>
      </form>
    `:"",n=o.length?o.map(r=>{let l=k(r.author_username,r.author_user_icon,40);return`
            <div class="profile-recommendation-item">
              <div class="task-applicant-head">
                <a href="/profile.html?user_id=${encodeURIComponent(r.author_user_id)}">
                  <img class="avatar-xs" src="${l}" alt="${r.author_username}" />
                </a>
                <div>
                  <a class="post-author-name" href="/profile.html?user_id=${encodeURIComponent(r.author_user_id)}">${r.author_username}</a>
                  <div class="reply-meta">${P(r.updated_at)}</div>
                </div>
              </div>
              <div class="profile-bio-copy">${g(r.content)}</div>
            </div>
          `}).join(""):`<div class='reply-empty'>${t("profile.noRecommendations")}</div>`;if(he.innerHTML=`
    <div class="badge">${t("profile.recommendation")}</div>
    ${e.i_blocked_user||e.blocked_me?`<div class="status-text">${e.i_blocked_user?t("profile.recommendationBlockedByYou"):t("profile.recommendationBlockedByOther")}</div>`:""}
    ${i}
    <div class="task-result-list">${n}</div>
  `,!e.can_recommend||e.i_blocked_user||e.blocked_me)return;let s=d("recommendationForm"),b=d("recommendationInput"),c=d("recommendationStatus");s.addEventListener("submit",async r=>{r.preventDefault();let l=b.value.trim();if(!l){c.textContent=t("profile.recommendationRequired");return}c.textContent=t("profile.submitting");let{response:u,data:y}=await Q(e.user_id,l);if(!u.ok){c.textContent=y.error||t("profile.submitFailed");return}c.textContent=t("profile.recommendationSaved"),b.value="",await T()})}a(A,"renderRecommendationPanel");async function T(){let e=Le()||le;xe=e;let{response:o,data:i}=await J(e);if(!o.ok||!i.profile){E.textContent=i.error||t("profile.loadFailed");return}let n=i.profile;E.textContent=n.is_me?t("profile.completeProfile"):t("profile.viewingProfile",{username:n.username}),H(n),F(n),U(n),A(n)}a(T,"loadProfile");async function Ie(){await N(),await ke(),await T()}a(Ie,"init");Ie();document.getElementById("logoutBtn")?.addEventListener("click",async()=>{try{await W()}finally{window.location.replace("/login.html")}});var Ue=[{key:"more_professional",label:"\u66F4\u4E13\u4E1A"},{key:"more_concise",label:"\u66F4\u7B80\u77ED"},{key:"more_structured",label:"\u66F4\u7ED3\u6784\u5316"},{key:"add_industry_keywords",label:"\u52A0\u4E0A\u884C\u4E1A\u5173\u952E\u8BCD"},{key:"warmer",label:"\u66F4\u4EB2\u5207\u53E3\u8BED"}],$=null,L=new Set;function R(e){let o=document.getElementById("bioRefineModal");o&&(o.classList.toggle("open",e),o.setAttribute("aria-hidden",e?"false":"true"))}a(R,"setBioRefineModalOpen");function Te(e){$=e,L.clear();let o=document.getElementById("bioRefineHints");o&&(o.innerHTML=Ue.map(r=>`<button type="button" class="btn-chip" data-hint="${r.key}">${r.label}</button>`).join(""),o.querySelectorAll("[data-hint]").forEach(r=>{r.addEventListener("click",()=>{let l=r.dataset.hint;L.has(l)?(L.delete(l),r.classList.remove("is-active")):(L.add(l),r.classList.add("is-active"))})}));let i=document.getElementById("bioRefineCurrent");i&&(i.textContent=e.value.trim()||"\uFF08\u7A7A \u2014 \u7CFB\u7EDF\u4F1A\u5EFA\u8BAE\u5148\u5199\u4E2A\u521D\u7A3F\uFF09");let n=document.getElementById("bioRefineExtra");n&&(n.value="");let s=document.getElementById("bioRefineResults");s&&(s.innerHTML="");let b=document.getElementById("bioRefineNotes");b&&(b.textContent="");let c=document.getElementById("bioRefineStatus");c&&(c.textContent=""),R(!0)}a(Te,"openBioRefineModal");document.getElementById("bioRefineCloseBtn")?.addEventListener("click",()=>{R(!1)});document.querySelector("#bioRefineModal .modal-backdrop")?.addEventListener("click",()=>R(!1));document.getElementById("bioRefineRunBtn")?.addEventListener("click",async()=>{if(!$)return;let e=document.getElementById("bioRefineRunBtn"),o=document.getElementById("bioRefineStatus"),i=document.getElementById("bioRefineResults"),n=document.getElementById("bioRefineNotes");e&&(e.disabled=!0),o&&(o.textContent="\u751F\u6210\u4E2D..."),i&&(i.innerHTML=""),n&&(n.textContent="");try{let s=document.getElementById("bioRefineExtra"),b=await fetch("/api/system-agent/bio/refine",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({current_bio:$.value,hints:Array.from(L),extra:s?.value??""})}),c=await b.json();if(!b.ok){o&&(o.textContent=c?.error||"\u751F\u6210\u5931\u8D25");return}o&&c.llm?o.textContent=`\u7531 ${c.llm.name}${c.llm.model?` \xB7 ${c.llm.model}`:""} \u751F\u6210`:o&&(o.textContent="");let r=c.drafts||[];i&&(i.innerHTML=r.map((l,u)=>`
            <div class="bio-refine-draft">
              <div class="bio-refine-draft-head">
                <span class="bio-refine-draft-label">${S(l.label||`\u5019\u9009 ${u+1}`)}</span>
                <button type="button" class="btn-inline btn-secondary" data-adopt="${u}">\u91C7\u7528</button>
              </div>
              <div class="bio-refine-draft-text">${S(l.text)}</div>
              ${l.rationale?`<div class="bio-refine-draft-rationale">\u8C03\u6574\uFF1A${S(l.rationale)}</div>`:""}
            </div>
          `).join(""),i.querySelectorAll("[data-adopt]").forEach(l=>{l.addEventListener("click",()=>{let u=Number(l.dataset.adopt);Number.isNaN(u)||!r[u]||!$||($.value=r[u].text,$.dispatchEvent(new Event("input",{bubbles:!0})),R(!1))})})),n&&c.notes&&(n.textContent=c.notes)}catch(s){o&&(o.textContent=`\u751F\u6210\u5931\u8D25\uFF1A${s.message}`)}finally{e&&(e.disabled=!1)}});function S(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}a(S,"escapeHtmlBio")});export default Re();
//# sourceMappingURL=profile.js.map
