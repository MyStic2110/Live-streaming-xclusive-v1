/**
 * AEO (Answer Engine Optimization) Utility
 * Handles dynamic injection of JSON-LD Schema.org metadata and SEO tags
 * for React Client-Side rendered applications.
 */

export const injectSchema = (id, schemaData) => {
  let schemaScript = document.getElementById(id);
  if (!schemaScript) {
    schemaScript = document.createElement('script');
    schemaScript.id = id;
    schemaScript.type = 'application/ld+json';
    document.head.appendChild(schemaScript);
  }
  
  if (Array.isArray(schemaData)) {
    // If it's an array of schemas, we can either serialize them as an array 
    // or wrap them in an @graph node
    schemaScript.text = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": schemaData.map(s => {
        const { "@context": _, ...rest } = s;
        return rest;
      })
    });
  } else {
    schemaScript.text = JSON.stringify(schemaData);
  }
};

export const removeSchema = (id) => {
  const schemaScript = document.getElementById(id);
  if (schemaScript) {
    schemaScript.remove();
  }
};

export const setMetaTag = (name, content, attribute = 'name') => {
  let meta = document.querySelector(`meta[${attribute}="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, name);
    document.head.appendChild(meta);
  }
  meta.content = content;
};

export const setCanonicalUrl = (url) => {
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = url;
};

export const setupPageAEO = ({ title, description, keywords, url, imageUrl, schemaId, schemaData }) => {
  if (title) document.title = title;
  
  if (description) {
    setMetaTag('description', description);
    setMetaTag('og:description', description, 'property');
    setMetaTag('twitter:description', description);
  }
  
  if (keywords) {
    setMetaTag('keywords', Array.isArray(keywords) ? keywords.join(', ') : keywords);
  }
  
  if (title) {
    setMetaTag('og:title', title, 'property');
    setMetaTag('twitter:title', title);
  }
  
  if (url) {
    setMetaTag('og:url', url, 'property');
    setCanonicalUrl(url);
  }
  
  if (imageUrl) {
    setMetaTag('og:image', imageUrl, 'property');
    setMetaTag('twitter:image', imageUrl);
    setMetaTag('twitter:card', 'summary_large_image');
  }

  if (schemaId && schemaData) {
    injectSchema(schemaId, schemaData);
  }
};

export const cleanupPageAEO = (schemaId) => {
  if (schemaId) {
    removeSchema(schemaId);
  }
};
