-- Local development seed (applied by `supabase start` on a fresh database and by `supabase db reset`).
--
-- Sample movies let the catalog, collections, groups and movie nights work without a TMDB key or an
-- internet connection. The numbers are approximate and the overviews are short original summaries.
-- When a TMDB key is configured, the API refreshes these rows with full TMDB details (posters,
-- cast, trailers) in the background.
insert into public.movies (
  tmdb_id, title, original_title, original_language, overview, release_date, runtime,
  release_status, genre_ids, popularity, vote_average, vote_count, certifications, is_sample
)
values
  (278, 'The Shawshank Redemption', 'The Shawshank Redemption', 'en', 'A banker sentenced to life in prison forms an unlikely friendship and holds on to hope over two decades.', '1994-09-23', 142, 'Released', '{18,80}', 85, 8.7, 27000, '{"US":"R"}', true),
  (238, 'The Godfather', 'The Godfather', 'en', 'The aging head of a New York crime family hands control of his empire to his reluctant youngest son.', '1972-03-14', 175, 'Released', '{18,80}', 80, 8.7, 20500, '{"US":"R"}', true),
  (155, 'The Dark Knight', 'The Dark Knight', 'en', 'Batman faces the Joker, a criminal mastermind who pushes Gotham City into chaos.', '2008-07-16', 152, 'Released', '{18,28,80,53}', 90, 8.5, 33000, '{"US":"PG-13"}', true),
  (680, 'Pulp Fiction', 'Pulp Fiction', 'en', 'Intertwined stories of Los Angeles criminals, a boxer and a pair of hitmen unfold out of order.', '1994-09-10', 154, 'Released', '{53,80}', 75, 8.5, 28000, '{"US":"R"}', true),
  (13, 'Forrest Gump', 'Forrest Gump', 'en', 'A kind-hearted man from Alabama drifts through decades of American history while waiting for his childhood love.', '1994-06-23', 142, 'Released', '{35,18,10749}', 70, 8.5, 27500, '{"US":"PG-13"}', true),
  (27205, 'Inception', 'Inception', 'en', 'A thief who steals secrets from dreams is offered a chance at redemption: planting an idea instead.', '2010-07-15', 148, 'Released', '{28,878,12}', 95, 8.4, 37000, '{"US":"PG-13"}', true),
  (550, 'Fight Club', 'Fight Club', 'en', 'An insomniac office worker and a soap salesman start an underground fight club that spirals out of control.', '1999-10-15', 139, 'Released', '{18}', 70, 8.4, 30000, '{"US":"R"}', true),
  (603, 'The Matrix', 'The Matrix', 'en', 'A hacker learns that his reality is a simulation and joins a rebellion against its machine creators.', '1999-03-30', 136, 'Released', '{28,878}', 80, 8.2, 26000, '{"US":"R"}', true),
  (157336, 'Interstellar', 'Interstellar', 'en', 'Explorers travel through a wormhole in search of a new home for humanity as Earth fails.', '2014-11-05', 169, 'Released', '{12,18,878}', 110, 8.4, 36000, '{"US":"PG-13"}', true),
  (129, 'Spirited Away', '千と千尋の神隠し', 'ja', 'A young girl wanders into a world of spirits and must work in a bathhouse to free her parents.', '2001-07-20', 125, 'Released', '{16,10751,14}', 75, 8.5, 16500, '{"US":"PG"}', true),
  (496243, 'Parasite', '기생충', 'ko', 'A poor family schemes its way into the household of a wealthy one, with unexpected consequences.', '2019-05-30', 133, 'Released', '{35,53,18}', 70, 8.5, 18500, '{"US":"R"}', true),
  (862, 'Toy Story', 'Toy Story', 'en', 'A cowboy doll feels threatened when a flashy new space ranger toy becomes the favorite.', '1995-11-22', 81, 'Released', '{16,12,10751,35}', 90, 8, 18500, '{"US":"G"}', true),
  (8587, 'The Lion King', 'The Lion King', 'en', 'A young lion prince flees his kingdom after his father''s death and must return to reclaim his place.', '1994-06-24', 89, 'Released', '{10751,16,18}', 85, 8.3, 18000, '{"US":"G"}', true),
  (12, 'Finding Nemo', 'Finding Nemo', 'en', 'An overprotective clownfish crosses the ocean to find his son, who ended up in a dentist''s aquarium.', '2003-05-30', 100, 'Released', '{16,10751}', 80, 7.8, 19500, '{"US":"G"}', true),
  (14160, 'Up', 'Up', 'en', 'A widowed balloon seller flies his house to South America, with a young stowaway on the porch.', '2009-05-28', 96, 'Released', '{16,35,10751,12}', 75, 8, 20000, '{"US":"PG"}', true),
  (354912, 'Coco', 'Coco', 'en', 'A boy who dreams of being a musician enters the Land of the Dead to uncover his family''s history.', '2017-10-27', 105, 'Released', '{10751,16,10402,12}', 80, 8.2, 19500, '{"US":"PG"}', true),
  (150540, 'Inside Out', 'Inside Out', 'en', 'The emotions inside an 11-year-old girl''s mind try to guide her through a difficult move to a new city.', '2015-06-17', 95, 'Released', '{16,10751,12,18,35}', 85, 7.9, 21000, '{"US":"PG"}', true),
  (10681, 'WALL·E', 'WALL·E', 'en', 'A lonely waste-collecting robot on an abandoned Earth falls for a sleek probe sent from space.', '2008-06-22', 98, 'Released', '{16,10751,878}', 65, 8.1, 18500, '{"US":"G"}', true),
  (105, 'Back to the Future', 'Back to the Future', 'en', 'A teenager is accidentally sent thirty years into the past and must make sure his parents fall in love.', '1985-07-03', 116, 'Released', '{12,35,878}', 70, 8.3, 20000, '{"US":"PG"}', true),
  (329, 'Jurassic Park', 'Jurassic Park', 'en', 'A theme park of cloned dinosaurs breaks down during a preview tour.', '1993-06-11', 127, 'Released', '{12,878}', 75, 7.9, 16500, '{"US":"PG-13"}', true),
  (771, 'Home Alone', 'Home Alone', 'en', 'An eight-year-old left behind during the Christmas holidays defends his home from two burglars.', '1990-11-16', 103, 'Released', '{35,10751}', 90, 7.4, 11500, '{"US":"PG"}', true),
  (346648, 'Paddington 2', 'Paddington 2', 'en', 'Paddington takes on odd jobs to buy a special present and ends up wrongly sent to prison.', '2017-11-09', 104, 'Released', '{12,35,10751}', 40, 7.6, 3000, '{"US":"PG"}', true),
  (9806, 'The Incredibles', 'The Incredibles', 'en', 'A family of undercover superheroes is pulled back into action to save the world.', '2004-10-27', 115, 'Released', '{28,12,16,10751}', 70, 7.7, 17500, '{"US":"PG"}', true),
  (2062, 'Ratatouille', 'Ratatouille', 'en', 'A rat with a gift for cooking teams up with a young kitchen worker in a famous Paris restaurant.', '2007-06-22', 111, 'Released', '{16,35,10751,14}', 70, 7.8, 16500, '{"US":"G"}', true),
  (808, 'Shrek', 'Shrek', 'en', 'A grumpy ogre sets out to rescue a princess so he can get his swamp back.', '2001-05-18', 90, 'Released', '{16,35,14,12,10751}', 85, 7.7, 17500, '{"US":"PG"}', true),
  (109445, 'Frozen', 'Frozen', 'en', 'A fearless princess sets off to find her sister, whose icy powers have trapped their kingdom in eternal winter.', '2013-11-20', 102, 'Released', '{16,10751,12,14}', 80, 7.2, 16500, '{"US":"PG"}', true),
  (324857, 'Spider-Man: Into the Spider-Verse', 'Spider-Man: Into the Spider-Verse', 'en', 'Teenager Miles Morales becomes Spider-Man and meets other Spider-People from parallel dimensions.', '2018-12-06', 117, 'Released', '{16,28,12,878}', 80, 8.4, 15500, '{"US":"PG"}', true),
  (372058, 'Your Name.', '君の名は。', 'ja', 'Two teenagers who have never met mysteriously begin to swap bodies.', '2016-08-26', 106, 'Released', '{16,10749,18}', 60, 8.5, 11500, '{"US":"PG"}', true),
  (8392, 'My Neighbor Totoro', 'となりのトトロ', 'ja', 'Two sisters who move to the countryside befriend the gentle forest spirits living nearby.', '1988-04-16', 86, 'Released', '{14,16,10751}', 55, 8.1, 8500, '{"US":"G"}', true),
  (10719, 'Elf', 'Elf', 'en', 'A human raised by Santa''s elves travels to New York City to find his real father.', '2003-10-09', 97, 'Released', '{35,14,10751}', 60, 6.6, 3500, '{"US":"PG"}', true),
  (508, 'Love Actually', 'Love Actually', 'en', 'Several intertwined love stories unfold in London in the weeks before Christmas.', '2003-09-07', 135, 'Released', '{35,10749,18}', 55, 7, 7000, '{"US":"R"}', true),
  (1585, 'It''s a Wonderful Life', 'It''s a Wonderful Life', 'en', 'An angel shows a despairing man what his town would have been like if he had never been born.', '1946-12-20', 130, 'Released', '{18,10751,14}', 45, 8.3, 4500, '{"US":"PG"}', true),
  (562, 'Die Hard', 'Die Hard', 'en', 'A New York cop takes on the robbers who seize a Los Angeles skyscraper on Christmas Eve.', '1988-07-15', 132, 'Released', '{28,53}', 60, 7.8, 11500, '{"US":"R"}', true),
  (120467, 'The Grand Budapest Hotel', 'The Grand Budapest Hotel', 'en', 'A legendary hotel concierge and his young protégé are caught up in the theft of a priceless painting.', '2014-02-26', 100, 'Released', '{35,18}', 55, 8, 15500, '{"US":"R"}', true),
  (313369, 'La La Land', 'La La Land', 'en', 'An aspiring actress and a jazz pianist fall in love while chasing their dreams in Los Angeles.', '2016-11-29', 128, 'Released', '{35,18,10749,10402}', 60, 7.9, 17000, '{"US":"PG-13"}', true),
  (546554, 'Knives Out', 'Knives Out', 'en', 'A famous detective investigates the death of a wealthy crime novelist and his suspicious family.', '2019-11-27', 131, 'Released', '{35,80,9648}', 60, 7.8, 13500, '{"US":"PG-13"}', true),
  (286217, 'The Martian', 'The Martian', 'en', 'An astronaut stranded on Mars uses his wits to survive until a rescue becomes possible.', '2015-09-30', 141, 'Released', '{18,12,878}', 60, 7.7, 20500, '{"US":"PG-13"}', true),
  (438631, 'Dune', 'Dune', 'en', 'A young noble''s family takes charge of the desert planet that holds the universe''s most valuable substance.', '2021-09-15', 155, 'Released', '{878,12}', 85, 7.8, 12500, '{"US":"PG-13"}', true),
  (693134, 'Dune: Part Two', 'Dune: Part Two', 'en', 'Paul Atreides unites with the Fremen to seek justice against those who destroyed his family.', '2024-02-27', 167, 'Released', '{878,12}', 95, 8.2, 6500, '{"US":"PG-13"}', true),
  (545611, 'Everything Everywhere All at Once', 'Everything Everywhere All at Once', 'en', 'A laundromat owner must connect with parallel versions of herself to save the multiverse.', '2022-03-24', 140, 'Released', '{28,12,878}', 55, 7.8, 6500, '{"US":"R"}', true),
  (508965, 'Klaus', 'Klaus', 'en', 'A spoiled postman sent to a frozen island town befriends a reclusive toymaker.', '2019-11-08', 97, 'Released', '{16,10751,12,35}', 50, 8.2, 5000, '{"US":"PG"}', true),
  (269149, 'Zootopia', 'Zootopia', 'en', 'A rookie bunny officer and a con-artist fox uncover a conspiracy in a city of animals.', '2016-02-11', 108, 'Released', '{16,12,10751,35}', 75, 7.7, 16500, '{"US":"PG"}', true),
  (194, 'Amélie', 'Le Fabuleux Destin d''Amélie Poulain', 'fr', 'A shy waitress in Paris quietly sets out to improve the lives of the people around her.', '2001-04-25', 122, 'Released', '{35,10749}', 45, 7.9, 11000, '{"US":"R"}', true),
  (120, 'The Lord of the Rings: The Fellowship of the Ring', 'The Lord of the Rings: The Fellowship of the Ring', 'en', 'A hobbit and eight companions set out to destroy a powerful ring before its dark lord can reclaim it.', '2001-12-18', 179, 'Released', '{12,14,28}', 90, 8.4, 25500, '{"US":"PG-13"}', true),
  (11, 'Star Wars', 'Star Wars', 'en', 'A farm boy joins a rebel princess, a smuggler and an old Jedi Knight to fight the Galactic Empire.', '1977-05-25', 121, 'Released', '{12,28,878}', 75, 8.2, 20500, '{"US":"PG"}', true),
  (872585, 'Oppenheimer', 'Oppenheimer', 'en', 'The story of the physicist who led the project to build the first atomic bomb.', '2023-07-19', 181, 'Released', '{18,36}', 90, 8.1, 9500, '{"US":"R"}', true)
on conflict (tmdb_id) do nothing;
