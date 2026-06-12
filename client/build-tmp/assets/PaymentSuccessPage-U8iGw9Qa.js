import{b as O,a1 as P,R as g,r as k,j as e,J as R,P as $,B as t,F as L,T as a,M as W,f as h,L as c,D,aZ as i}from"./index-BjzcwbkG.js";import{C as b}from"./CheckCircleOutline-tN_wjuM_.js";import{R as N}from"./ReceiptLong-BOW7T7sN.js";import{S as y,L as z}from"./LocalShippingOutlined-BoP9PHpV.js";import{o as B}from"./orderService-CmpbzdXW.js";const T=i`
    from {
        opacity: 0;
        transform: translate3d(0, 18px, 0) scale(0.96);
    }
    to {
        opacity: 1;
        transform: translate3d(0, 0, 0) scale(1);
    }
`,Y=i`
    0% {
        opacity: 0;
        transform: scale(0.45) rotate(-12deg);
    }
    60% {
        opacity: 1;
        transform: scale(1.12) rotate(3deg);
    }
    100% {
        opacity: 1;
        transform: scale(1) rotate(0deg);
    }
`,E=i`
    0% {
        opacity: 0.45;
        transform: scale(0.72);
    }
    100% {
        opacity: 0;
        transform: scale(1.55);
    }
`,A=i`
    0% {
        opacity: 0;
        transform: translateY(-24px) rotate(0deg);
    }
    18% {
        opacity: 1;
    }
    100% {
        opacity: 0;
        transform: translateY(96px) rotate(190deg);
    }
`,F=[{left:"15%",top:8,color:"#67e8f9",delay:"0.05s",rotate:"12deg"},{left:"26%",top:0,color:"#f9a8d4",delay:"0.2s",rotate:"-18deg"},{left:"38%",top:14,color:"#fde68a",delay:"0.12s",rotate:"30deg"},{left:"58%",top:4,color:"#86efac",delay:"0.28s",rotate:"-28deg"},{left:"72%",top:16,color:"#c4b5fd",delay:"0.16s",rotate:"18deg"},{left:"84%",top:2,color:"#fb7185",delay:"0.34s",rotate:"-10deg"}],Z=()=>{var p,m,x,f,u;const s=O(),{fetchCart:d}=P(),j=new URLSearchParams(s.search),r=((p=s.state)==null?void 0:p.orderId)||j.get("orderId"),v=(m=s.state)==null?void 0:m.isCod,[n,C]=g.useState(null),[M,w]=g.useState(!!r&&!((x=s.state)!=null&&x.orderNumber)),l=((f=s.state)==null?void 0:f.orderNumber)||(n==null?void 0:n.orderNumber),S=r?`/account/orders/${r}`:"/orders";return k.useEffect(()=>{var o;d(),r&&!((o=s.state)!=null&&o.orderNumber)&&B.getMyOrderById(r).then(C).catch(console.error).finally(()=>w(!1))},[d,r,(u=s.state)==null?void 0:u.orderNumber]),e.jsx(R,{maxWidth:"md",sx:{py:{xs:5,md:8}},children:e.jsxs($,{elevation:0,sx:{position:"relative",overflow:"hidden",px:{xs:2.5,sm:5},py:{xs:4,sm:5},borderRadius:3,border:"1px solid",borderColor:"divider",textAlign:"center",background:"linear-gradient(180deg, rgba(34,197,94,0.10) 0%, rgba(255,255,255,0.025) 42%, rgba(255,255,255,0.015) 100%)",animation:`${T} 520ms ease-out both`},children:[F.map((o,I)=>e.jsx(t,{sx:{position:"absolute",left:o.left,top:o.top,width:9,height:15,borderRadius:"2px",bgcolor:o.color,opacity:0,transform:`rotate(${o.rotate})`,animation:`${A} 1.8s ease-in-out ${o.delay} both`}},I)),e.jsxs(t,{sx:{position:"relative",mx:"auto",mb:2.5,width:108,height:108,display:"grid",placeItems:"center"},children:[e.jsx(t,{sx:{position:"absolute",inset:6,borderRadius:"50%",border:"2px solid",borderColor:"success.main",animation:`${E} 1.5s ease-out 220ms both`}}),e.jsx(t,{sx:{width:88,height:88,borderRadius:"50%",display:"grid",placeItems:"center",bgcolor:"rgba(34, 197, 94, 0.12)",border:"1px solid",borderColor:"success.main",boxShadow:"0 18px 44px rgba(34, 197, 94, 0.18)",animation:`${Y} 620ms cubic-bezier(.2,.9,.2,1.2) both`},children:e.jsx(b,{sx:{fontSize:58,color:"success.main"}})})]}),e.jsx(L,{label:v?"Cash on delivery order confirmed":"Payment successful",color:"success",variant:"outlined",sx:{mb:2,fontWeight:700}}),e.jsx(a,{variant:"h3",component:"h1",fontWeight:800,sx:{fontSize:{xs:30,sm:42},mb:1},children:"Order Placed!"}),e.jsxs(a,{color:"text.secondary",sx:{maxWidth:560,mx:"auto",mb:3,lineHeight:1.7},children:["Thank you for your order. We are getting it ready now and will keep you updated as it moves forward.",l?` Order reference: #${l}`:r?` Order reference: #${r}`:""]}),e.jsxs(W,{direction:{xs:"column",sm:"row"},spacing:1.5,justifyContent:"center",sx:{mb:4},children:[e.jsx(h,{variant:"contained",size:"large",component:c,to:"/orders",startIcon:e.jsx(N,{}),children:"View Orders"}),e.jsx(h,{variant:"outlined",size:"large",component:c,to:"/products",startIcon:e.jsx(y,{}),children:"Continue Shopping"})]}),e.jsx(D,{sx:{mb:3}}),e.jsx(t,{sx:{display:"grid",gridTemplateColumns:{xs:"1fr",sm:"repeat(3, 1fr)"},gap:1.5,textAlign:"left"},children:[{title:"Order received",text:"Your order is safely in our system.",icon:e.jsx(b,{})},{title:"Preparing items",text:"We will pack and process your products.",icon:e.jsx(y,{})},{title:"Delivery updates",text:"Tracking details will appear in your orders.",icon:e.jsx(z,{})}].map(o=>e.jsxs(t,{component:c,to:S,sx:{display:"flex",gap:1.25,p:1.5,borderRadius:2,bgcolor:"action.hover",border:"1px solid",borderColor:"divider",color:"inherit",textDecoration:"none",transition:"transform 160ms ease, border-color 160ms ease, background-color 160ms ease","&:hover, &:focus-visible":{transform:"translateY(-2px)",borderColor:"success.main",bgcolor:"rgba(34, 197, 94, 0.08)",outline:"none"}},children:[e.jsx(t,{sx:{color:"success.main",display:"flex",mt:.25},children:o.icon}),e.jsxs(t,{children:[e.jsx(a,{variant:"body2",fontWeight:800,children:o.title}),e.jsx(a,{variant:"caption",color:"text.secondary",children:o.text})]})]},o.title))})]})})};export{Z as default};
