import React, { useState } from "react";
import axios from "axios";
import LiveList from "./components/layout/LiveList";
import VideoRoom from "./components/rooms/VideoRoom";
import LinaRoom from "./components/rooms/LinaRoom";
import BIRoom from "./components/rooms/BIRoom";
import NovaRoom from "./components/rooms/NovaRoom";
import BlogSection from "./components/layout/BlogSection";
import AstraRoom from "./components/rooms/AstraRoom";
import RehearsalRoom from "./components/rooms/RehearsalRoom";
import SevaRoom from "./components/rooms/SevaRoom";
import MartechRoom from "./components/rooms/MartechRoom";
import OctaneRoom from "./components/rooms/OctaneRoom";
import DevopsGeniRoom from "./components/rooms/DevopsGeniRoom";
import AivyuhRoom from "./components/rooms/AivyuhRoom";
import ShoppeRoom from "./components/rooms/ShoppeRoom";
import DevopsOrb from "./components/layout/DevopsOrb";
import SwarmShortsPage from "./components/dashboard/SwarmShortsPage";
import DashboardPage from "./components/dashboard/DashboardPage";
import ComplianceDashboard from "./components/dashboard/ComplianceDashboard";
import GovernedDeployment from "./components/dashboard/GovernedDeployment";
import NotFoundPage from "./components/layout/NotFoundPage";
import CopilotWidget from "./components/layout/CopilotWidget";
import LoginPage from "./components/auth/LoginPage";
import ResetPasswordPage from "./components/auth/ResetPasswordPage";
import ConsoleLayout from "./components/layout/ConsoleLayout";
import '@livekit/components-styles/index.css';
import "./index.css";

const API = import.meta.env.VITE_API_URL || "";

function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [roomData, setRoomData] = useState(null);
  const [showBlog, setShowBlog] = useState(false);
  const [showShorts, setShowShorts] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.hash || window.location.pathname);
  const [isWaPopupOpen, setIsWaPopupOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("fleet");

  // Sync currentPath to activeTab
  React.useEffect(() => {
    if (isDashboardPath) setActiveTab("analytics");
    else if (isDeploymentPath) setActiveTab("governance");
    else if (isShortsPath) setActiveTab("sneak-peak");
    else if (isInsightsPath) setActiveTab("insights");
    else if (isCompliancePath) setActiveTab("compliance");
    else setActiveTab("fleet");
  }, [currentPath]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setShowBlog(false);
    setShowShorts(false);
    if (tabId === "analytics") {
      window.history.pushState({}, "", "/dashboard");
      setCurrentPath("/dashboard");
    } else if (tabId === "compliance") {
      window.history.pushState({}, "", "/compliance");
      setCurrentPath("/compliance");
    } else if (tabId === "governance") {
      window.history.pushState({}, "", "/governed-deployment");
      setCurrentPath("/governed-deployment");
    } else if (tabId === "sneak-peak") {
      window.history.pushState({}, "", "/sneak-peak");
      setCurrentPath("/sneak-peak");
    } else if (tabId === "insights") {
      window.history.pushState({}, "", "/insights");
      setCurrentPath("/insights");
      setShowBlog(true);
    } else {
      window.history.pushState({}, "", "/");
      setCurrentPath("/");
    }
  };

  React.useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  React.useEffect(() => {
    // Auto-open WhatsApp popup after 5 seconds if not closed in this session
    const hasClosed = sessionStorage.getItem("wa-popup-closed");
    if (!hasClosed) {
      const timer = setTimeout(() => {
        setIsWaPopupOpen(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  React.useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.hash || window.location.pathname);
    };
    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, []);

  const navigateToShorts = () => handleTabChange("sneak-peak");
  const navigateToDashboard = () => handleTabChange("analytics");
  const navigateToDeployment = () => handleTabChange("governance");
  const navigateHome = () => handleTabChange("fleet");
  const navigateToLogin = () => {
    console.log('navigateToLogin invoked');
    window.location.hash = "#/login";
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setToken(null);
    setActiveTab("fleet");
    window.history.pushState({}, "", "/");
    setCurrentPath("/");
  };

  React.useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          const errorData = error.response.data;
          const errorMsg = errorData && (errorData.error || errorData.message || "");
          if (
            typeof errorMsg === "string" && (
              errorMsg.toLowerCase().includes("session expired") ||
              errorMsg.toLowerCase().includes("invalid token") ||
              errorMsg.toLowerCase().includes("please re-authenticate") ||
              errorMsg.toLowerCase().includes("access token required") ||
              errorMsg.toLowerCase().includes("please login")
            )
          ) {
            handleLogout();
          }
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const handleJoin = (data) => {
    console.log(`[FRONTEND] Entering room: ${data.roomName} | Agent: ${data.creatorId}`);
    setRoomData(data);
  };

  const handleLeave = () => {
    console.log(`[FRONTEND] Leaving room.`);
    setRoomData(null);
  };

  const toggleBlog = () => {
    setShowBlog(!showBlog);
  };

  const isLina      = roomData?.creatorId === "LINA";
  const isBI        = roomData?.creatorId === "BI";
  const isBI2       = roomData?.creatorId === "BI2";
  const isNova      = roomData?.creatorId === "NOVA";

  const isAstra     = roomData?.creatorId === "ASTRA";
  const isRehearsal = roomData?.creatorId === "REHEARSAL";
  const isSeva      = roomData?.creatorId === "SEVA";
  const isMartech   = roomData?.creatorId === "MARTECH";
  const isOctane    = roomData?.creatorId === "OCTANE";
  const isDevopsGeni = roomData?.creatorId === "DEVOPS_GENI";
  const isAivyuh    = roomData?.creatorId === "AIVYUH" || roomData?.creatorId === "aivyuh";
  const isShoppe    = roomData?.creatorId === "SHOPPE";


  const isFleetPath =
    currentPath.replace(/\/$/, "") === "/fleet" ||
    window.location.hash.replace(/\/$/, "") === "#/fleet" ||
    window.location.hash === "#fleet" ||
    window.location.hash === "#/fleet/";

  const isShortsPath =
    currentPath.replace(/\/$/, "") === "/sneak-peak" ||
    window.location.hash === "#/sneak-peak";

  const isDashboardPath =
    currentPath.replace(/\/$/, "") === "/dashboard" ||
    window.location.hash === "#/dashboard" ||
    window.location.hash === "#dashboard";

  const isCompliancePath =
    currentPath.replace(/\/$/, "") === "/compliance" ||
    window.location.hash.replace(/\/$/, "") === "#/compliance" ||
    window.location.hash === "#compliance" ||
    window.location.hash === "#/compliance/";

  const isDeploymentPath =
    currentPath.replace(/\/$/, "") === "/governed-deployment" ||
    window.location.hash.replace(/\/$/, "") === "#/governed-deployment" ||
    window.location.hash === "#governed-deployment" ||
    window.location.hash === "#/governed-deployment/";

  const isInsightsPath =
    currentPath.replace(/\/$/, "") === "/insights" ||
    window.location.hash.replace(/\/$/, "") === "#/insights" ||
    window.location.hash === "#insights" ||
    window.location.hash === "#/insights/";

  const isBlogPath =
    currentPath.replace(/\/$/, "") === "/blog" ||
    currentPath.startsWith("/blog/") ||
    window.location.hash.replace(/\/$/, "") === "#/blog" ||
    window.location.hash.startsWith("#/blog/");

  const isLoginPath =
    currentPath.replace(/\/$/, "") === "/login" ||
    window.location.hash.replace(/\/$/, "") === "#/login" ||
    window.location.hash === "#login";

  const isResetPasswordPath =
    currentPath.replace(/\/$/, "") === "/reset-password" ||
    window.location.hash.replace(/\/$/, "") === "#/reset-password";

  let content;
  if (showBlog || isInsightsPath || isBlogPath || activeTab === "insights") {
    content = <BlogSection onBack={() => handleTabChange("fleet")} currentPath={currentPath} setCurrentPath={setCurrentPath} />;
  } else if (showShorts || isShortsPath || activeTab === "sneak-peak") {
    content = <SwarmShortsPage onBack={() => handleTabChange("fleet")} />;
  } else if (isDashboardPath || activeTab === "analytics") {
    content = <DashboardPage onBack={() => handleTabChange("fleet")} />;
  } else if (isCompliancePath || activeTab === "compliance") {
    content = <ComplianceDashboard onBack={() => handleTabChange("fleet")} />;
  } else if (isDeploymentPath || activeTab === "governance") {
    content = <GovernedDeployment onBack={() => handleTabChange("fleet")} />;
  } else if (roomData) {
    content = isDevopsGeni ? (
      <DevopsGeniRoom roomData={roomData} onLeave={handleLeave} />
    ) : isLina ? (
      <LinaRoom roomData={roomData} onLeave={handleLeave} />
    ) : isBI ? (
      <BIRoom roomData={roomData} onLeave={handleLeave} />
    ) : isBI2 ? (
      <BIRoom roomData={roomData} onLeave={handleLeave} />
    ) : isNova ? (
      <NovaRoom roomData={roomData} onLeave={handleLeave} />

    ) : isAivyuh ? (
      <AivyuhRoom roomData={roomData} onLeave={handleLeave} />
    ) : isAstra ? (
      <AstraRoom roomData={roomData} onLeave={handleLeave} />
    ) : isRehearsal ? (
      <RehearsalRoom roomData={roomData} onLeave={handleLeave} />
    ) : isSeva ? (
      <SevaRoom roomData={roomData} onLeave={handleLeave} />
    ) : isShoppe ? (
      <ShoppeRoom roomData={roomData} onLeave={handleLeave} />
    ) : isMartech ? (
      <MartechRoom roomData={roomData} onLeave={handleLeave} />
    ) : isOctane ? (
      <OctaneRoom roomData={roomData} onLeave={handleLeave} />
    ) : (
      <VideoRoom roomData={roomData} onLeave={handleLeave} />
    );
  } else if (
    currentPath === "/" ||
    currentPath === "" ||
    isFleetPath ||
    (currentPath.startsWith("#") && !currentPath.startsWith("#/login") && !currentPath.startsWith("#/reset-password")) ||
    activeTab === "fleet"
  ) {
    content = (
      <LiveList 
        onJoin={handleJoin} 
        onBlogClick={() => handleTabChange("insights")} 
        onShortsClick={navigateToShorts}
        onDashboardClick={navigateToDashboard}
        onDeploymentClick={navigateToDeployment}
        user={user}
        onLoginClick={navigateToLogin}
        onLogout={handleLogout}
      />
    );
  } else {
    content = <NotFoundPage onBack={navigateHome} />;
  }

  const handleLoginSuccess = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    if (currentPath === "/login" || window.location.hash === "#/login" || window.location.hash === "#login") {
      navigateHome();
    }
  };

  React.useEffect(() => {
    if (token && user && isLoginPath) {
      navigateHome();
    }
  }, [token, user, isLoginPath]);

  const isAuthenticated = !!(token && user);

  // Reset password page: public, no auth required
  if (isResetPasswordPath) {
    return <ResetPasswordPage onBack={navigateToLogin} />;
  }

  // Active room sessions — full screen, no chrome
  if (roomData) {
    return (
      <div className="app-container">
        {content}
      </div>
    );
  }

  // The landing page (fleet/home at "/") is ALWAYS standalone for guests — never inside ConsoleLayout
  // When authenticated, the operator Control Panel Workspace is wrapped inside ConsoleLayout
  const isLandingPage =
    !isAuthenticated &&
    !isDashboardPath && !isDeploymentPath && !isCompliancePath &&
    !showBlog && !isShortsPath && !isLoginPath && !isResetPasswordPath && !isInsightsPath && !isBlogPath &&
    (currentPath === "/" || currentPath === "" || isFleetPath ||
     (currentPath.startsWith("#") && !currentPath.startsWith("#/login") && !currentPath.startsWith("#/reset-password")) ||
     activeTab === "fleet");

  if (isLandingPage) {
    return (
      <div className="app-container">
        {content}
      </div>
    );
  }

  // Direct login page route (unauthenticated)
  if (isLoginPath) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Gate protected pages (Analytics/Dashboard, Compliance) behind login
  const isProtected = isDashboardPath || isCompliancePath;
  if (!isAuthenticated && isProtected) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Authenticated sub-pages: wrap in ConsoleLayout with sidebar nav
  if (isAuthenticated) {
    return (
      <ConsoleLayout
        user={user}
        onLogout={handleLogout}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      >
        {content}
        <DevopsOrb />
        <CopilotWidget />
      </ConsoleLayout>
    );
  }

  // Unauthenticated public sub-pages (Governance, Insights, Shorts) — no ConsoleLayout
  return (
    <div className="app-container">
      {content}
    </div>
  );
}

export default App;
