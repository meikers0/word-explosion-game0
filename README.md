<div align="center">

<img width="1200" height="475" alt="WordExplosion Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# 💣 WordExplosion: Multiplayer Word Game

**Desafía tu mente y tus reflejos en este explosivo juego de palabras en tiempo real.**
Based on the classic *BombParty* mechanics & *Social Deduction* games.

<!-- Badges -->
<p>
  <img src="https://img.shields.io/badge/Node.js-22.x-339933?style=for-the-badge&logo=nodedotjs" alt="Node.js" />
  <img src="https://img.shields.io/badge/Socket.io-Realtime-black?style=for-the-badge&logo=socketdotio" alt="Socket.io" />
  <img src="https://img.shields.io/badge/Express-Server-000000?style=for-the-badge&logo=express" alt="Express" />
  <img src="https://img.shields.io/badge/Status-Active-success?style=for-the-badge" alt="Status" />
</p>

[View App in AI Studio](https://ai.studio/apps/drive/1jghxlih_vJyR99SzwvnTtYWioNAqE_hm) • [Report Bug](https://github.com/tu-usuario/tu-repo/issues) • [Request Feature](https://github.com/tu-usuario/tu-repo/issues)

</div>

---

## 📖 Sobre el Proyecto

**WordExplosion** es un juego web multijugador diseñado para generar tensión y diversión. Los jugadores deben escribir palabras rápidamente que contengan una sílaba específica antes de que la bomba explote, o deducir quién es el mentiroso en el modo Impostor.

Construido con **Node.js** y **Socket.io**, ofrece una experiencia de baja latencia ideal para jugar con amigos en salas privadas.

## ✨ Características Principales

### 🎮 Modos de Juego
1.  **💥 Word Explosion (Clásico):**
    *   Escribe una palabra que contenga la sílaba mostrada (ej: "OS" -> "Oso", "Mosca").
    *   ¡El tiempo es aleatorio! La bomba puede explotar en cualquier momento.
    *   Si explota en tu turno, pierdes una vida ❤️.

2.  **🕵️ Impostor de Palabras (Nuevo):**
    *   Todos reciben una palabra secreta excepto uno: **El Impostor**.
    *   Di una pista relacionada con tu palabra.
    *   ¡Debatan y voten para expulsar al sospechoso!

### ⚙️ Funcionalidades Técnicas
*   **Salas Privadas:** Crea salas con códigos únicos de 4 letras para jugar solo con tus amigos.
*   **Diccionario Inteligente:** Validación de palabras en español utilizando un diccionario optimizado.
*   **Sistema de Vidas y Puntuación:** Tabla de clasificación persistente por sesión.
*   **UI/UX Reactiva:** Avatares, animaciones de explosión, scroll suave y diseño Dark Mode.

---

## 🚀 Instalación y Ejecución Local

Sigue estos pasos para correr el juego en tu computadora.

### Prerrequisitos
*   **Node.js** (Versión 18 o superior recomendada).
*   **NPM** (Viene instalado con Node).

### Pasos

1.  **Clonar el repositorio:**
    ```bash
    git clone [https://github.com/TU_USUARIO/NOMBRE_DEL_REPO.git](https://github.com/TU_USUARIO/NOMBRE_DEL_REPO.git)
    cd NOMBRE_DEL_REPO
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    ```

3.  **Configurar Variables de Entorno:**
    Crea un archivo `.env.local` (o `.env`) en la raíz del proyecto y agrega tu API Key (si estás usando funciones de IA de Gemini):
    ```env
    GEMINI_API_KEY=tu_api_key_aqui
    PORT=3000
    ```

4.  **Ejecutar el servidor:**
    ```bash
    npm run start
    ```

5.  **¡Jugar!**
    Abre tu navegador y ve a: `http://localhost:3000`

---

## 🛠️ Tecnologías Usadas

*   **Backend:** Node.js, Express.
*   **Real-time:** Socket.io.
*   **Frontend:** HTML5, CSS3, Vanilla JavaScript.
*   **Deploy:** Optimizado para Render.com.

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Si tienes una idea para mejorar el diccionario o un nuevo modo de juego:

1.  Haz un Fork del proyecto.
2.  Crea tu rama de características (`git checkout -b feature/NuevaCaracteristica`).
3.  Haz Commit de tus cambios (`git commit -m 'Agregada nueva característica'`).
4.  Haz Push a la rama (`git push origin feature/NuevaCaracteristica`).
5.  Abre un Pull Request.

---

<div align="center">
  Hecho con ❤️ y mucho estrés 💣
</div>
