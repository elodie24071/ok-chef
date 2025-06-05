// declarer variable pour stocker les recettes
var recettes = [];
function afficherRecettes(filtre) {
    var moncontenu = '';
    // Si un filtre est appliqué, on ne garde que les recettes correspondantes
    var recettesFiltrees = recettes.filter(function (post) {
        return filtre === 'Toutes' || post.type === filtre;
    });


    // si definit 'data-max-recettes' dans html, on limite le nombre de recettes affichées
    // sinon on affiche toutes les recettes
    var maxRecettes = $('#contenu').data('max-recettes');
    var nbrRecettes = maxRecettes ? Math.min(recettesFiltrees.length, maxRecettes) : recettesFiltrees.length;
    for (var i = 0; i < nbrRecettes; i++) {
        var post = recettesFiltrees[i];
        // Encode le nom de la recette pour l'utiliser dans l'URL
        // encodeURIComponent gère espaces et caractères spéciaux
        var urlRecette = encodeURIComponent(post.nom_recette);
        moncontenu +=
            `<div class="relative w-full min-h-[350px] flex justify-center items-end bg-jaune rounded-lg lg:mt-10">
                <img src="img/spirales.svg" alt="spirales" class="absolute left-1 -top-5 lg:-top-8 w-full object-cover z-20">
                <div class="relative z-10 flex flex-col h-full gap-2 md:gap-4 lg:gap-6 xl:gap-10 px-3 py-10 md:px-6 lg:px-8 sm:pt-15 md:pt-16 lg:pb-8 font-quicksand text-sm">
                    <div class="flex flex-col justify-center items-center mt-6">
                        <h1 class="font-gochi text-jaune bg-rouge px-2 py-1 inline-block text-center text-base sm:lg md:text-xl lg:text-4xl">${post.nom_recette}</h1>
                        <p class="text-xs sm:sm md:text-base lg:text-lg text-rouge text-center pt-6">${post.description} !</p>
                    </div>
                    <div class="flex justify-center flex-wrap items-center text-xs sm:sm md:text-base lg:text-lg gap-2 lg:gap-4 mb-4">
                        <div class="flex items-center  border-2 border-rouge rounded-full px-2 py-1 text-rouge">
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
                    <a href="details-recette.html?nom_recette=${urlRecette}"
                        class="text-sm md:text-base lg:text-lg inline-block bg-orange border-2 text-jaune px-2 py-1 rounded-full text-center hover:border-orange hover:bg-transparent hover:text-rouge">Voir la recette
                    </a>
                </div>
            </div>`;
    }
    $('#contenu').html(moncontenu);
}


var url = 'https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLgAEvimHDsM3IMR156gYZNTbzltPcUzwo5bZO9GayDA9rz9wSo7GUjTsF0_MnB0Ec7xKOpqOu6gg6-Y4lEdEBHokjY7T1-Jm0X-8TKep4IWrN3L1rKeqkFb0D3scpY_eBg0_WsgZ9i45CNncI9ckvyBrHiCiZdJRLFaTz_sgxDf2_s6TUb21oqOFA68SjY79tPd047S93H1G2-pacccNh8bR30Ub6F9HwV4LIYuF_6A8P5OWlNKB18G7HYzERX-VQoDaiLT1-idPvlYNS-o2nmKl4LxQw&lib=MuwGKftncQnHMDPGwJsYRX4QAT1r8vRmO';
$.ajax({
    type: 'GET',
    url: url,
    dataType: 'json',
    success: function (data) {
        console.log("Données récupérées :", data);
        recettes = data;

        // afficher toutes les recettes par défaut
        afficherRecettes('Toutes');

        // si btn filtre existe, ajouter les événements de clic
        if ($('.filtre-btn').length) {
            $('.filtre-btn').on('click', function () {
                $('.filtre-btn')
                    .removeClass('bg-orange text-jaune')
                    .addClass('bg-jaune text-rouge');
                $(this)
                    .removeClass('bg-jaune text-rouge')
                    .addClass('bg-orange text-jaune');

                var filtre = $(this).data('filtre');
                afficherRecettes(filtre);
            });
        }
    }, // fin success
    error: function () {
        alert('An error occurred while loading content.');
    } // fin error
}); // fin ajax

// loader
window.addEventListener('load', function () {
    setTimeout(function () {
        document.getElementById('loader').classList.add('hidden');
    }, 3000);
});