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
let etatAssistant = 'inactif'; // état précis de l'assistant (inactif, attente_demarrage, lecture_etape, en_pause, termine)
let aAnnonceCommande = false; // pour éviter de répéter la commande "OK Chef" après la première fois

// mettre à jour l'état du bouton
function majEtatBtn(microActif) {
    const btnActiver = $('#activer-micro');
    const btnArreter = $('#arreter');
    if (microActif) {
        // Micro activé - désactiver le bouton "activer" et activer "désactiver"
        btnActiver.prop('disabled', true)
            .removeClass('hover:bg-transparent hover:text-jaune')
            .addClass('opacity-50 cursor-not-allowed')
            .text('Micro activé');

        btnArreter.prop('disabled', false)
            .removeClass('opacity-50 cursor-not-allowed')
            .addClass('hover:bg-transparent hover:text-jaune');
    }
    else {
        // Micro désactivé - activer le bouton "activer" et désactiver "désactiver"
        btnActiver.prop('disabled', false)
            .removeClass('opacity-50 cursor-not-allowed')
            .addClass('hover:bg-transparent hover:text-jaune')
            .text('Activer l\'assistant vocal');

        btnArreter.prop('disabled', true)
            .removeClass('hover:bg-transparent hover:text-jaune')
            .addClass('opacity-50 cursor-not-allowed');
    }
}

// eviter que l'assistant s'écoute lui-même
function parler(texte) {
    if (reconnaissanceVocale && enEcoute) {
        reconnaissanceVocale.stop();
        enEcoute = false;
    }

    const utterance = new SpeechSynthesisUtterance(texte);
    utterance.lang = 'fr-FR';

    // qd assistant finit de parler...
    utterance.onend = function () {
        okChefDetecte = false; // réinitialise la détection "OK Chef" après avoir parlé
        if (reconnaissanceVocale && assistantActif && !enEcoute) { // redémarre la reconnaissance vocale si l'assistant est actif
            setTimeout(function () {
                if (!enEcoute && assistantActif) {
                    try {
                        reconnaissanceVocale.start();
                        enEcoute = true;
                    } catch (e) {
                        console.error('Erreur lors du redémarrage:', e);
                    }
                }
            }, 500); // redémarre après 500ms
        }
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
    reconnaissanceVocale.continuous = true; // continuer à écouter après chaque résultat

    // gestion des résultats
    reconnaissanceVocale.onresult = function (event) {
        const transcription = Array.from(event.results)
            .map(result => result[0].transcript)
            .join(' ')
            .toLowerCase();
        console.log('Transcription:', transcription);

        // détecter "OK Chef" pour démarrer l'assistant
        if (transcription.includes('ok chef')) {
            okChefDetecte = true;
            vientDeDireNon = false;
            etatAssistant = 'attente_demarrage';
            parler("Bonjour, je suis votre assistant vocal. Êtes-vous prêt à cuisiner ?");
            return;
        }

        // repeter l'étape actuelle
        if (transcription.includes('répéter') || transcription.includes('repeter') || transcription.includes('repète')) {
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
            if (etapeActuelle < etapes.length - 1) { // si pas à la dernière étape
                etapeActuelle++; 
                lireEtapeActuelle();
            } else {
                parler("C'est la fin de la recette. Bon appétit !");
                etapeActuelle = 0;
                etatAssistant = 'termine';
                setTimeout(function () {
                    if (reconnaissanceVocale && enEcoute) {
                        assistantActif = false;
                        reconnaissanceVocale.stop();
                        enEcoute = false;
                        okChefDetecte = false;
                        etatAssistant = 'inactif';
                        aAnnonceCommande = false;
                        majEtatBtn(false);
                        parler("Assistant vocal désactivé. Merci d'avoir utilisé l'assistant vocal.");
                    }
                }, 5000);
            }
            return;
        }

        // vérifier les demandes d'étape spécifique (généré avec l'aide de l'ia)
        const etapeSpecifique = transcription.match(/(étape|etape) (\d+)/);
        if (etapeSpecifique) {
            const numEtape = parseInt(etapeSpecifique[2]) - 1; 
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
    };

    reconnaissanceVocale.onerror = function (event) {
        console.error('Erreur de reconnaissance vocale:', event.error);
        if (event.error === 'no-speech' && assistantActif) {
            setTimeout(function () {
                if (reconnaissanceVocale) {
                    reconnaissanceVocale.start(); // redémarrer la reconnaissance vocale après une erreur
                    enEcoute = true; // mettre à jour l'état
                }
            }, 1000); // attendre 1 seconde avant de redémarrer
        }
    };
}

function lireEtapeActuelle() {
    if (etapes.length === 0) return;
    console.log('Lecture étape:', etapeActuelle + 1, etapes[etapeActuelle]); // Debug
    const texteEtape = `Étape ${etapeActuelle + 1} : ${etapes[etapeActuelle]}`;
    parler(texteEtape);

    // annonce des commandes seulement après la première étape
    if (etapeActuelle === 0 && !aAnnonceCommande) {
        aAnnonceCommande = true;
        setTimeout(function () {
            parler("Dites 'répéter' pour que je répète l'étape actuelle, ou 'suivante' pour passer à la prochaine étape.");
        }, 10000); // attendre 10 secondes avant d'annoncer les commandes
    }
}


function attacherEvenements() {
    // activer micro
    $('#activer-micro').on('click', function () {
        if (!reconnaissanceVocale) initReconnaissance();
        if (!enEcoute) {
            assistantActif = true;
            reconnaissanceVocale.start();
            enEcoute = true;
            majEtatBtn(true);
            parler("Assistant vocal activé. Dites 'OK Chef' pour commencer.");
        }
    });

    // désactiver micro
    $('#arreter').on('click', function () {
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

        // split: détecte les virgules dans la liste des ingrédients
        // map: permet de créer un tableau pour chaque ingrédient
        // trim: enlève les espaces autour des ingrédients
        var listeIngredients = post.ingredients.split(',').map(function (ingredient, i) {
            return `<div class="">
                <input type="checkbox" id="ingredient-${i}" name="ingredient-${i}" class="appearance-none w-4 h-4 border-2 border-rouge bg-transparent rounded-sm checked:bg-rouge hover:bg-rouge"/>
                <label for="ingredient-${i}" class="ml-1">${ingredient.trim()}</label>
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
                    <button id="activer-micro" class=" bg-jaune text-rouge hover:bg-transparent hover:text-jaune px-4 py-2 rounded-full text-sm lg:text-lg  border-2 border-rouge transition-all duration-300 ease-in-out cursor-pointer"> Activer l'assistant vocal
                    </button>
                    <button id="arreter" disabled class=" bg-jaune text-rouge px-4 py-2 rounded-full text-sm lg:text-lg border-2 border-rouge opacity-50 cursor-not-allowed transition-all duration-300 ease-in-out">Désactiver l'assistant vocal
                    </button>
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
                doc.text("-"  + ingredient, 10, 20 + (i * 10));
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