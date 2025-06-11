// lire le nom de la recette depuis l'URL
function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}
const nomRecette = getQueryParam('nom_recette');

// INITIALISATION DES VARIABLES
// variables reconnaissance vocale
const synthVocale = window.speechSynthesis;
let reconnaissanceVocale;
let enEcoute = false;
let okChefDetecte = false;
// variables étapes
let etapeActuelle = 0; // index de l'étape actuelle
let etapes = [];
// variables d'état
let vientDeDireNon = false;
let assistantActif = false;
let etatAssistant = 'inactif'; // état précis de l'assistant (inactif, lecture_etape, termine)
let aAnnonceCommande = false; // pour éviter de répéter la commande "OK Chef" après la première fois
let timeoutAnnonce = null; // eviter annonce après étape 1, si on donne une commande avant les 10 secondes

// redemarrer l'écoute après avoir parlé
function redemarrerEcoute() {
    if (assistantActif && !enEcoute && reconnaissanceVocale && !synthVocale.speaking) {
        setTimeout(() => {
            // double chef pour eviter de redemarrer l'écoute si l'assistant est en train de parler
            if (assistantActif && !enEcoute && !synthVocale.speaking && etatAssistant !== 'parle') {
                try {
                    reconnaissanceVocale.start();
                    enEcoute = true;
                    console.log('Ecoute redémarrée');
                } catch (e) {
                    console.error('Erreur lors du redémarrage de l\'écoute:', e);
                }
            }
        }, 1000);
    }
}
// mettre à jour l'état du bouton
function majEtatBtn(microActif) {
    const btnActiver = $('#activer-micro');
    const btnArreter = $('#arreter');
    if (microActif) {
        // Micro activé - désactiver le bouton "activer" et activer "désactiver"
        btnActiver.prop('disabled', true)
            .removeClass('hover:bg-transparent hover:text-jaune hover:border-rouge cursor-pointer')
            .addClass('opacity-50 cursor-not-allowed')
            .text('Micro activé');

        btnArreter.prop('disabled', false)
            .removeClass('opacity-50 cursor-not-allowed')
            .addClass('hover:bg-transparent hover:text-jaune hover:border-rouge cursor-pointer');
    }
    else {
        // Micro désactivé - activer le bouton "activer" et désactiver "désactiver"
        btnActiver.prop('disabled', false)
            .removeClass('opacity-50 cursor-not-allowed')
            .addClass('hover:bg-transparent hover:text-jaune hover:border-rouge cursor-pointer')
            .text('Activer l\'assistant vocal');

        btnArreter.prop('disabled', true)
            .removeClass('hover:bg-transparent hover:text-jaune hover:border-rouge cursor-pointer')
            .addClass('opacity-50 cursor-not-allowed');
    }
}

function nettoyerTimeouts() {
    if (timeoutAnnonce) {
        clearTimeout(timeoutAnnonce);
        timeoutAnnonce = null;
        console.log('Timeout annonce nettoyé');
    }
}

// eviter que l'assistant s'écoute lui-même
function parler(texte) {
    majEtatAssis('parle');
    if (reconnaissanceVocale && enEcoute) {
        reconnaissanceVocale.stop();
        enEcoute = false;
    }

    const utterance = new SpeechSynthesisUtterance(texte);
    utterance.lang = 'fr-FR';

    // qd assistant finit de parler...
    utterance.onend = function () {
        okChefDetecte = false; // réinitialise la détection "OK Chef" après avoir parlé
        if (assistantActif) {
            if (etatAssistant !== 'attente_ok_chef') {
                if (etatAssistant === 'en_pause' || etatAssistant === 'lecture_etape' && etapeActuelle < etapes.length) {
                    majEtatAssis('ecoute');
                }
            }
        }
        redemarrerEcoute(); // redémarre l'écoute après avoir parlé

    };

    synthVocale.speak(utterance);
}

// initialiser la reconnaissance vocale
function initReconnaissance() { // vérifier si le navigateur supporte la reconnaissance vocale
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Votre navigateur ne supporte pas la reconnaissance vocale. Utilisez Chrome ou Edge.');
        return;
    }

    reconnaissanceVocale = new (window.SpeechRecognition || window.webkitSpeechRecognition)(); // créer l'objet de reconnaissance vocale
    reconnaissanceVocale.lang = 'fr-FR';
    reconnaissanceVocale.interimResults = false; // pas afficher les résultats intermédiaires
    reconnaissanceVocale.continuous = false;

    // gérer l'arret automatique de la reconnaissance vocale
    reconnaissanceVocale.onend = function () {
        enEcoute = false; // mettre à jour l'état
        console.log('Reconnaissance vocale arrêtée');
        // redemarrer automatiquement si l'assistant est encore actif
        if (assistantActif && etatAssistant !== 'parle') {
            redemarrerEcoute();
        }
    }

    // gérer demarrage de la reconnaissance vocale
    reconnaissanceVocale.onstart = function () {
        enEcoute = true; 
        console.log('Reconnaissance vocale démarrée');
    };

    // gestion des résultats
    reconnaissanceVocale.onresult = function (event) {
        const transcription = Array.from(event.results)
            .map(result => result[0].transcript)
            .join(' ')
            .toLowerCase();
        console.log('Transcription:', transcription);
        enEcoute = false;

        // détecter "OK Chef" pour démarrer l'assistant
        if (transcription.includes('ok chef')) {
            okChefDetecte = true;
            vientDeDireNon = false;
            etatAssistant = 'attente_demarrage';
            setTimeout(() => { // change l'état après 3 secondes
                if (etatAssistant === 'attente_demarrage') {
                    majEtatAssis('ecoute');
                }
            }, 3000);
            parler("Bonjour, je suis votre assistant vocal. Êtes-vous prêt à cuisiner ?");
            return;
        }

        // repeter l'étape actuelle
        if (transcription.includes('répéter') || transcription.includes('repeter') || transcription.includes('repète')) {
            nettoyerTimeouts();
            lireEtapeActuelle();
            return;
        }

        // détecter "commencer" pour démarrer après avoir dit "non"
        if (transcription.includes('commencer') || transcription.includes('commence')) {
            if (etatAssistant === 'en_pause') {
                etatAssistant = 'lecture_etape';
                parler("Très bien, commençons la recette !");
                setTimeout(() => {
                    lireEtapeActuelle();
                }, 2000);
            }
            return;
        }

        // detecter "suivante" pour passer à l'étape suivante
        if (transcription.includes('suivante') || transcription.includes('suivant')) {
            nettoyerTimeouts();
            if (etapeActuelle < etapes.length - 1) { // si pas à la dernière étape
                etapeActuelle++;
                lireEtapeActuelle();
            } else {
                parler("C'est la fin de la recette. Bon appétit !");
                etapeActuelle = 0;
                etatAssistant = 'termine';
                majEtatAssis('termine');
                setTimeout(function () {
                    if (reconnaissanceVocale && enEcoute) {
                        assistantActif = false;
                        reconnaissanceVocale.stop();
                        enEcoute = false;
                        okChefDetecte = false;
                        etatAssistant = 'inactif';
                        aAnnonceCommande = false;
                        majEtatBtn(false);
                        // annoncer la désactivation de l'assistant
                        const utteranceDesactiver = new SpeechSynthesisUtterance("Assistant vocal désactivé.");
                        utteranceDesactiver.lang = 'fr-FR';
                        utteranceDesactiver.onend = function () {
                            majEtatAssis('inactif');
                        };
                        synthVocale.speak(utteranceDesactiver);
                    }
                }, 5000);
            }
            return;
        }

        // vérifier les demandes d'étape spécifique (généré avec l'aide de l'ia)
        const etapeSpecifique = transcription.match(/(étape|etape)\s*(\d+|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)/i);
        if (etapeSpecifique) {
            // convertir les mots en nombres
            const motsEtape = {
                'un': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5,
                'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10
            };

            const numStr = etapeSpecifique[2].toLowerCase();
            const numEtape = parseInt(motsEtape[numStr] || numStr) - 1; // -1 pour l'indexation à partir de 0
            if (numEtape >= 0 && numEtape < etapes.length) {
                etapeActuelle = numEtape;
                lireEtapeActuelle();
            } else {
                parler("Désolé, il n'y a pas d'étape " + (numEtape + 1) + " dans cette recette.");
            }
            return;
        }

        // detecter "oui" pour démarrer la recette
        if (transcription.includes('oui') && etatAssistant === 'attente_demarrage') {
            vientDeDireNon = false;
            etatAssistant = 'lecture_etape';
            parler("Très bien, commençons la recette !");
            setTimeout(() => {
                lireEtapeActuelle();
            }, 2000);
            return;
        }

        // detecter "non" pour mettre en pause
        if (transcription.includes('non') && etatAssistant === 'attente_demarrage' && !vientDeDireNon) {
            console.log('Détection de "non" : dire le message d\'attente');
            vientDeDireNon = true;
            etatAssistant = 'en_pause';
            parler("D'accord, je reste à votre disposition. Dites 'commencer' lorsque vous êtes prêt !");
            return;
        }

        // redemarrer l'écoute apres traitement si aucune commande n'est détectée
        if (assistantActif) {
            redemarrerEcoute();
        }
    };

    reconnaissanceVocale.onerror = function (event) {
        console.error('Erreur de reconnaissance vocale:', event.error);
        enEcoute = false;
        if (event.error === 'no-speech' && assistantActif) {
            redemarrerEcoute(); // redémarrer l'écoute si aucune parole n'est détectée
        } else if (event.error === 'aborted' && assistantActif) {
            redemarrerEcoute(); // redémarrer l'écoute si l'utilisateur a interrompu la reconnaissance
        }
    };
}

function lireEtapeActuelle() {
    if (etapes.length === 0) return;
    console.log('Lecture étape:', etapeActuelle + 1, etapes[etapeActuelle]); // Debug
    const texteEtape = `Étape ${etapeActuelle + 1} : ${etapes[etapeActuelle]}`;
    etatAssistant = 'lecture_etape';
    parler(texteEtape);

    // annonce des commandes seulement après la première étape
    if (etapeActuelle === 0 && !aAnnonceCommande) {
        aAnnonceCommande = true;
        nettoyerTimeouts();
        timeoutAnnonce = setTimeout(function () {
            parler("Dites 'répéter' pour que je répète l'étape actuelle, ou 'suivante' pour passer à la prochaine étape.");
            timeoutAnnonce = null; // réinitialiser le timeout
        }, 10000); // attendre 10 secondes avant d'annoncer les commandes
    }
}

// suivi état assistant
function majEtatAssis(etat) {
    const indicateur = document.getElementById('indicateur-assis');
    const msg = document.getElementById('msg-assis');

    switch (etat) {
        case 'inactif':
            indicateur.className = 'inline-block w-3 h-3 rounded-full bg-gray-400';
            msg.textContent = 'Assistant inactif';
            break;
        case 'attente_ok_chef':
            indicateur.className = 'inline-block w-3 h-3 rounded-full bg-yellow-400 animate-pulse';
            msg.textContent = 'Dites "OK Chef" pour démarrer';
            break;
        case 'ecoute':
            indicateur.className = 'inline-block w-3 h-3 border-1 border-green-700 rounded-full bg-green-400 animate-ping';
            msg.textContent = 'Assistant en écoute';
            break;
        case 'parle':
            indicateur.className = 'inline-block w-3 h-3 rounded-full bg-red-700';
            msg.textContent = 'Assistant en train de parler';
            break;
        case 'termine':
            indicateur.className = 'inline-block w-3 h-3 rounded-full bg-gray-400';
            msg.textContent = 'Assistant terminé';
            break;
        default:
            console.error('État inconnu:', etat);
    }
}

// boutons (dés)activer l'assistant vocal
function attacherEvenements() {
    // activer micro
    $('#activer-micro').on('click', function () {
        if (!reconnaissanceVocale) initReconnaissance();
        if (!enEcoute) {
            assistantActif = true;
            etatAssistant = 'attente_ok_chef'; // mettre l'assistant en état d'attente de "OK Chef"
            reconnaissanceVocale.start();
            enEcoute = true;
            majEtatBtn(true);
            parler("Assistant vocal activé. Dites 'OK Chef' pour commencer.");
            majEtatAssis('attente_ok_chef');
        }
    });

    // désactiver micro
    $('#arreter').on('click', function () {
        nettoyerTimeouts();
        if (reconnaissanceVocale && enEcoute) {
            assistantActif = false;
            reconnaissanceVocale.stop();
            enEcoute = false;
            okChefDetecte = false; // réinitialiser la détection "OK Chef"
            etatAssistant = 'inactif'; // mettre l'assistant en état inactif
            aAnnonceCommande = false; // réinitialiser l'annonce des commandes
            majEtatBtn(false);
            parler("Assistant vocal désactivé.");
        }
        majEtatAssis('inactif');
    });
}

var url = 'https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLgAEvimHDsM3IMR156gYZNTbzltPcUzwo5bZO9GayDA9rz9wSo7GUjTsF0_MnB0Ec7xKOpqOu6gg6-Y4lEdEBHokjY7T1-Jm0X-8TKep4IWrN3L1rKeqkFb0D3scpY_eBg0_WsgZ9i45CNncI9ckvyBrHiCiZdJRLFaTz_sgxDf2_s6TUb21oqOFA68SjY79tPd047S93H1G2-pacccNh8bR30Ub6F9HwV4LIYuF_6A8P5OWlNKB18G7HYzERX-VQoDaiLT1-idPvlYNS-o2nmKl4LxQw&lib=MuwGKftncQnHMDPGwJsYRX4QAT1r8vRmO';
$.ajax({
    type: 'GET',
    url: url,
    dataType: 'json',
    success: function (data) {
        console.log(data);

        var recettes = data;
        var moncontenu = '';
        // Cherche recette par son nom
        var post = recettes.find(function (bonNom) {
            return bonNom.nom_recette === nomRecette;
        });

        if (!post) {
            $('#contenu-details').html('<p>Recette non trouvée.</p>');
            return;
        }

        var listeIngredients = post.ingredients.split(',').map(function (ingredient, i) {
            return `<div>
                <input type="checkbox" id="ingredient-${i}" name="ingredient-${i}" class="appearance-none w-4 h-4 border-2 border-rouge bg-transparent rounded-sm checked:bg-rouge hover:bg-rouge transition-all duration-300 ease-in-out cursor-pointer"/>
                <label for="ingredient-${i}" class="ml-1 cursor-pointer">${ingredient.trim()}</label>
            </div>`;
        }
        ).join('');

        var listeEtapes = post.etapes.split(';').map(function (etape, i) {
            return `<div class="bg-rouge rounded-lg p-2 min-w-[200px] md:min-w-0 md:min-h-[100px] lg:min-h-[150px]">
                <p class="text-sm md:base lg:text-lg">${i + 1}. ${etape.trim()}.</p>
            </div>`;
        }
        ).join('');

        moncontenu +=
            `<div class="bg-jaune rounded-lg p-4 lg:p-8 mt-2 w-full max-w-md lg:max-w-6xl flex flex-col items-center gap-4 lg:gap-10">
                <h1 class="font-gochi text-jaune bg-orange px-2 py-1 inline-block text-lg lg:text-6xl">${post.nom_recette}</h1>
                <p class="font-quicksand text-sm lg:text-2xl text-rouge text-center">${post.description} !</p>
                <div class="font-quicksand flex justify-center flex-wrap items-center text-xs lg:text-xl gap-3">
                    <div class="flex items-center border-2 border-rouge rounded-full px-2 py-1 text-rouge">
                        <i class="fa-solid fa-stopwatch text-xs sm:sm md:text-base lg:text-lg mr-1 lg:mr-2"></i>${post.temps} min.
                    </div>
                    <div class="flex items-center border-2 border-rouge rounded-full px-2 py-1 text-rouge">
                        <i class="fa-solid fa-user text-xs sm:sm md:text-base lg:text-lg mr-1 lg:mr-2"></i>${post.personne} pers.
                    </div>
                    <div class="flex items-center  border-2 border-rouge rounded-full px-2 py-1 text-rouge">
                        <i class="fa-solid fa-signal text-xs sm:sm md:text-base lg:text-lg mr-1 lg:mr-2"></i> ${post.niveau}
                    </div>
                    <div class="flex items-center  border-2 border-rouge rounded-full px-2 py-1 text-rouge">
                        <i class="fa-solid fa-utensils text-xs sm:sm md:text-base lg:text-lg mr-1 lg:mr-2"></i>${post.type}
                    </div>
                </div>
            </div>
            <div class="font-quicksand w-full flex flex-col sm:flex-row sm:gap-4 lg:gap-8 mt-4">
                <div class="bg-jaune text-rouge rounded-lg p-6 mt-2 w-full sm:w-[60%]">
                    <h2 class="font-bold mb-2 text-base md:lg lg:text-xl">Guide d'utilisation de l'assistant vocal</h2>
                    <p class="mb-4 text-sm md:base lg:text-lg">Appuyez sur le bouton "<span class="!text-[#FF9D00] font-bold">Activer l'assistant vocal</span>" pour commencer.
                    </p>
                    <div class="text-sm md:base lg:text-lg">
                        <p class="mb-2">Pour naviguer dans la recette, dites :</p>
                        <ul class="list-disc pl-5 space-y-1">
                            <li>"<span class="text-orange font-bold">Répéter</span>" pour que l'assistant répète l'étape actuelle.</li>
                            <li>"<span class="text-orange font-bold">Suivante</span>" pour passer à la prochaine étape.</li>
                            <li>"<span class="text-orange font-bold">Étape X</span>" pour aller à l'étape X (par exemple, "Étape 2").</li>
                        </ul>
                    </div>
                </div>
                <div class="bg-orange font-quicksand rounded-lg p-4 mt-2 w-full sm:w-[40%] flex flex-col justify-center gap-4">
                    <button id="activer-micro" class=" bg-jaune text-rouge hover:bg-transparent hover:text-jaune px-4 py-2 rounded-full text-sm lg:text-lg border-2 border-transparent hover:border-rouge transition-all duration-300 ease-in-out cursor-pointer"> Activer l'assistant vocal
                    </button>
                    <button id="arreter" disabled class=" bg-jaune text-rouge px-4 py-2 rounded-full text-sm lg:text-lg border-2 border-transparent opacity-50 cursor-not-allowed transition-all duration-300 ease-in-out">Désactiver l'assistant vocal
                    </button>
                    <div id="status-assis" class="flex justify-center items-center gap-2 mt-2"><span id="indicateur-assis" class="inline-block w-3 h-3 rounded-full bg-gray-400 transition-colors"></span><span id="msg-assis" class="text-xs text-gray-600">Assistant innactif</span>
                    </div>
                </div>
            </div>
            
            <div class="w-full md:flex md:gap-4 lg:flex lg:gap-8 mt-4 font-quicksand">
                <div class="bg-jaune rounded-lg p-4 mt-2 w-full md:w-[35%] lg:w-[25%] min-h-[300px]">
                    <div class="flex justify-between">
                        <h2 class="text-rouge font-bold mb-2 text-base md:lg lg:text-xl">Ingrédients</h2>
                        <a id="telecharger-pdf" class="cursor-pointer">
                            <i class="fa-solid fa-file-pdf text-sm md:text-base lg:text-lg mr-1 lg:mr-2 text-rouge hover:text-orange"></i>
                        </a>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 sm:gap-2 md:grid-cols-1 gap-2 text-rouge text-sm md:base lg:text-lg">
                    ${listeIngredients}</div>
                </div>
                <div class="bg-jaune rounded-lg p-4 mt-2 w-full md:w-[65%] lg:w-[75%]">
                    <h2 class="text-rouge font-bold mb-2 text-base md:lg lg:text-xl">Etapes</h2>
                    <div class="text-jaune flex md:flex-wrap gap-2 md:gap-4 lg:gap-6 overflow-x-auto md:overflow-x-visible md:grid md:grid-cols-3 lg:grid-cols-4">
                    ${listeEtapes}</div>
                </div>
            </div>`


        console.log(moncontenu);
        $('#contenu-details').html(moncontenu);

        // récupérer les étapes de la recette
        // on split les étapes par le caractère ';' et on enlève les espaces autour
        etapes = post.etapes.split(';').map(e => e.trim());

        attacherEvenements(); // attacher les événements aux boutons

        // telecharger le PDF
        document.getElementById('telecharger-pdf').addEventListener('click', function () {
            //recuperer ingredients en texte
            var ingredients = post.ingredients.split(',').map(ingredient => ingredient.trim());

            // créer le contenu du PDF
            var doc = new window.jspdf.jsPDF();
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(18);
            doc.text("Liste des ingrédients", 10, 10);
            doc.setFontSize(12);
            ingredients.forEach((ingredient, i) => {
                doc.text("-" + ingredient, 10, 20 + (i * 10));
            });
            doc.save("ingredients.pdf");
        });

    }, // fin success
    error: function () {
        alert('An error occurred while loading content.');
    } // fin error
}); // fin ajax

// loader
window.addEventListener('load', function () {
    setTimeout(function () {
        document.getElementById('loader').classList.add('hidden');
    }, 5000);
});