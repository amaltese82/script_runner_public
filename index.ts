import firebase from 'firebase-admin';
import { Firestore, Timestamp, FieldValue } from '@google-cloud/firestore';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as filesys from 'fs';


const fs = require('fs').promises; 
console.log('START SCRIPT');

const admin = firebase.initializeApp({
    credential: firebase.credential.cert("intraverse-dev.json")
});

//numero di PVP non validate, ma con lo score di uno dei due giocatori settato (che sarebbero quelli andati in out of synch)

const db = firebase.firestore();

type TypeRoom = "Versus_PVP" | "Versus_PVE" | null;

const _GameRoom="GameRoom";


interface DocumentExport {
    id: string;
    data: FirebaseFirestore.DocumentData;
}

interface ExportData {
    [collectionName: string]: DocumentExport[] | null;
}

interface Interval {
    startDate: string;
    endDate: string;
}

interface Round {
    roundName: string;
    endDate: Date;
}

interface Booster {
    Status?: string,
    CreationDate?: FieldValue,
    ActivationDate?: Timestamp,
    ProductId?: string,
    BoosterValue?: number,
    Id?: string,
    RemainingDuration?: number,
    BoosterDuration?: number,
    Name?: string
  }

interface Gameroom {
    CreatedBy?: string,
    Id?: string,
    Name?: string,
    players?: player[],
    Type?: TypeRoom,
    status?: string,
    validated: boolean,
    createdAt:Timestamp,
}

interface User{
    nome:string,
    username:string,
    createdAt:any,
    id:string,
    email:string,
    wallets?:string[],
    boosters?:Booster[]
}

interface player {
    JoinedAt?: Date,
    ValidScore?: boolean,
    id?: User,
    idPhoton?: string,
    projectId?: string,
    savedScoreAt?: Date,
    score?: number,
}

var PVP_room = 0;
var PVE_room = 0;
var Error_room=0;

class Operation {
    private db: Firestore;

    constructor(db: Firestore) {
        if(!db)
            throw new Error("db is not defined");
        this.db = db;
    }

    public getRoomWithoutType(): Promise<Gameroom[]> {
        return new Promise(async (solve, _error) => {
            try {
                const gameRoom: Gameroom[] = [];
                const gameSnapShot=await db.collection(_GameRoom).where("status","==","closed").where("Type","==",null).get();
                gameSnapShot.forEach(doc=>{
                    let gromm:Gameroom=doc.data() as Gameroom;
                    gameRoom.push(gromm);
                });
                solve(gameRoom);
            } catch (error) {
                _error(error);
            }
        });

    }
}

const fetchGameroomsWithOnePlayerScoreNull = async (): Promise<[Gameroom[], Gameroom[],Gameroom[],Gameroom[]]> => {
    const filteredGamerooms: Gameroom[] = [];
    const GameRoomOk: Gameroom[] = [];
    const ErrorRoom: Gameroom[] = [];
    const DisconnectedRoom: Gameroom[] = [];
    try {
        console.log("start function");
        const gameroomsSnapshot = await db.collection('GameRoom').where("createdAt",">=",new Date("2024-03-22")).get();
        console.log("TOTAL ROOMS "+gameroomsSnapshot.size);

        gameroomsSnapshot.forEach(doc => {
            const gameroom: Gameroom = doc.data() as Gameroom;
            if (gameroom.Type == "Versus_PVP" && gameroom.players && gameroom.createdAt.toDate() >= new Date("2024-03-22")) {
                //console.log(gameroom?.players[0]?.id?.id);
                PVP_room++
                // Verifica che almeno uno dei giocatori abbia lo score a null
                const hasNullScore = gameroom.players.some((player: player) => player.score === null) &&
                    gameroom.players.some((player: player) => player.score !== null);
                if (hasNullScore) {
                    filteredGamerooms.push(gameroom);
                    return;
                }
                //verifichiamo che entrambi i player abbiano lo score a null
                let currentDisconnected=true;
                gameroom.players.forEach((player: player) => {
                    if (player.score !== null) {
                        currentDisconnected=false;
                    }
                })
                if(currentDisconnected){
                    DisconnectedRoom.push(gameroom);
                    return;
                }
                if(gameroom.validated)
                    GameRoomOk.push(gameroom);
            }else if(gameroom.Type == "Versus_PVE" && gameroom.players){
                PVE_room++;
            }else{
                Error_room++;
                ErrorRoom.push(gameroom);
            }
        });
    } catch (error) {
        console.error("Error fetching gamerooms:", error);
    }
    return [filteredGamerooms, GameRoomOk,ErrorRoom,DisconnectedRoom];
};
var projects:any=[];

const getPointsOfUsers = async () => {
    let userPoints = new Map<string, number>();
    const projectsIds:any[]=[];
    let rounds=["hcIz7v3JELxHxciFYHAD","FKBVhc7QyfLzGPXLyhWj"];
    for (const roundId of rounds){
        const round = await db.collection("tournaments").doc("tournament2023").collection("rounds").doc(roundId).get();
        const roundData = round.data();
        const p = roundData?.projectIds;
        for (const projectId of p) {
            if(!projectsIds.includes(projectId)){
                console.log("pushed another project");
                projectsIds.push(projectId);
            }
        }
    }
    
    
    /*if (projectIds) {
        for (const projectId of projectIds) {
            const projectSnapShot = await db.collection("projects").doc(projectId).get();
            const project = projectSnapShot.data();
            const projectName = project?.name;
            const pointSnapShot = await db.collection("gamePoints").where("projectId", "==", projectId).
                where("roundId", "==", "hcIz7v3JELxHxciFYHAD").get();
            const pointSnapShot2 = await db.collection("gamePoints").where("projectId", "==", projectId).
                where("roundId", "==", "FKBVhc7QyfLzGPXLyhWj").get();
            const points = pointSnapShot.docs.map(doc => doc.data());
            points.push(...pointSnapShot2.docs.map(doc => doc.data()));
            console.log(points.length);

            for (const point of points) {
                if (!point.points) continue;

                const userSnapShot = await db.collection("users").doc(point.userId).get();
                if (!userSnapShot.exists) continue;

                const user = userSnapShot.data();
                const username = user?.email;

                if (userPoints.has(username)) {
                    let currentPoints = userPoints.get(username) || 0;
                    currentPoints += point.points;
                    userPoints.set(username, currentPoints);
                } else {
                    userPoints.set(username, point.points);
                }
            }
            console.log("pushed");
            projects.push({points: userPoints,name: projectName});
            userPoints = new Map<string, number>();
        }
    }*/
};


const clearUserWallets=async ()=>{
    console.log("--- BEGIN ClearWalletUser ---");
    const userSnapShot=await db.collection("users").get();
    userSnapShot.forEach(doc => {
        const email = doc.data().email;
        if(email=="andrea@intraverse.io"){
            db.collection("users").doc(doc.id).update({
                wallets: []
            });
        }
    });
    console.log("--- END ClearWalletUser ---");
};

const GetAllUserEmail=async ()=>{
    const userSnapShot=await db.collection("users").get();
    let listEmail:string[]=[];
    userSnapShot.forEach(doc=>{
        let user:User=doc.data() as User;
        listEmail.push(user.email+" : "+user.username);
    });
    //scrivi su file tutte le email
    const fs = require('fs');
    fs.writeFileSync('email.txt', listEmail.join("\n"));
}

const getUsersBoosters=async ()=>{
    console.log("--- BEGIN GetUserBoosters ---");
    const getAllUsers = true;
    const usersList = ['andrea@intraverse.io', 'daven8989@gmail.com'];
    const users = await db.collection("users").get();
    users.forEach(user => {
        if(user.data().boosters){
            const email = user.data().email;
            if(getAllUsers){
                const output = {
                    "email": user.data().email,
                    "boosters": user.data().boosters
                }
                console.log(output);
            } else if(usersList.includes(email)){
                const output = {
                    "email": user.data().email,
                    "boosters": user.data().boosters
                }
                console.log(output);
            } 
        }
    });
    console.log("--- END GetUserBoosters ---");
};

const addFreeBoostersToUsers = async ()=>{
    console.log("--- BEGIN addFreeBoostersToUsers ---");
    //se someUsers è un array vuoto viene applicato il free boosters a tutti, se no a quelli in array
    const someUsers:String[] = ["andrea@intraverse.io"];

    try {
        // Retrieve all users
        const usersSnapshot = await db.collection('users').get();
    
        // Loop through each user document
        usersSnapshot.forEach(async (doc) => {
            const email = doc.data().email;
            if(someUsers.length === 0 || someUsers.includes(email)){
                const userData = doc.data();
            
                // Check if boosters array exists, if not, create it
                if (!userData.boosters || !Array.isArray(userData.boosters)) {
                    userData.boosters = [];
                }
            
                // Add booster objects to boosters array
                const boostersToAdd = [
                    {
                    BoosterDuration: 15,
                    BoosterValue: 4,
                    CreationDate: Timestamp.fromDate(new Date),
                    Id: generateRandomString(20),
                    Name: "15 MIN",
                    ProductId: "Jc6g1DPZNFuZpYSmjDgh",
                    RemainingDuration: 15,
                    Status: "ready",
                    Free: true
                    },
                    {
                    BoosterDuration: 30,
                    BoosterValue: 4,
                    CreationDate: Timestamp.fromDate(new Date),
                    Id: generateRandomString(20),
                    Name: "30 MIN",
                    ProductId: "T72lwXCQklznIpwU8UBs",
                    RemainingDuration: 30,
                    Status: "ready",
                    Free: true
                    },
                    {
                    BoosterDuration: 60,
                    BoosterValue: 4,
                    CreationDate: Timestamp.fromDate(new Date),
                    Id: generateRandomString(20),
                    Name: "60 MIN",
                    ProductId: "fWdHX4CboXJsVvbnmTfB",
                    RemainingDuration: 60,
                    Status: "ready",
                    Free: true
                    },
                    {
                    BoosterDuration: 120,
                    BoosterValue: 4,
                    CreationDate: Timestamp.fromDate(new Date),
                    Id: generateRandomString(20),
                    Name: "120 MIN",
                    ProductId: "buMXvm9HJhXKKUTxfYgJ",
                    RemainingDuration: 120,
                    Status: "ready",
                    Free: true
                    }
                ];
            
                // Push new booster objects to boosters array
                userData.boosters.push(...boostersToAdd);
            
                // Update user document with modified boosters array
                await db.collection('users').doc(doc.id).set(userData);
                //console.log("finalBoosters: ", boostersToAdd)
            }
        });
    
        console.log("Boosters updated successfully.");
      } catch (error) {
        console.error("Error updating boosters:", error);
      }
      console.log("--- END addFreeBoostersToUsers ---");
}

// Function to generate a random unique string
function generateRandomString(length:number) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

const deleteFreeBoosters = async ()=>{
    console.log("--- BEGIN deleteFreeBoosters ---");
    try {
        // Retrieve all users
        const usersSnapshot = await db.collection('users').get();
    
        // Loop through each user document
        usersSnapshot.forEach(async (doc) => {
            const email = doc.data().email;
            //if(email=="andrea@intraverse.io"){
                const userData = doc.data();
            
                // Check if boosters array exists
                if (userData.boosters && Array.isArray(userData.boosters) && userData.boosters.length > 0) {
                    // Filter out boosters with "Free" property set to true, if "Free" property exists
                    userData.boosters = userData.boosters.filter(booster => !booster.hasOwnProperty('Free') || booster.Free === false);
                    
                    // Update user document with modified boosters array
                    await db.collection('users').doc(doc.id).update({ boosters: userData.boosters });
                }
            //}
        });
    
        console.log("Free boosters removed successfully.");
    } catch (error) {
    console.error("Error removing free boosters:", error);
    }

    console.log("--- END deleteFreeBoosters ---");
}

async function getRecentAndPreviousRoundEndDates() {
    try {
      const tournamentDocRef = db.collection('tournaments').doc('tournament2023');
      const roundsRef = tournamentDocRef.collection('rounds');
      const roundsSnapshot = await roundsRef.get();
  
      if (roundsSnapshot.empty) {
        console.log('No rounds found.');
        return;
      }
  
      const rounds: Round[] = roundsSnapshot.docs.map(doc => {
        const data = doc.data();
        const intervals: Interval[] = data.intervals;
  
        if (!intervals || intervals.length === 0) {
          return null; // Ignore rounds with no intervals
        }
  
        const endDate = intervals.reduce((maxDate: Date, interval: Interval) => {
          const end = new Date(interval.endDate);
          return end > maxDate ? end : maxDate;
        }, new Date('0000-01-01T00:00:00.000Z'));
  
        return {
          roundName: data.roundName,
          endDate: endDate
        };
      }).filter(round => round !== null) as Round[]; // Filter out null values
  
      // Sort rounds by their endDate in descending order
      rounds.sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
  
      const recentRound = rounds[0];
      const previousRound = rounds[1];
  
      if (recentRound) {
        console.log('Most Recent Round End Date:', recentRound.endDate);
        console.log('Most Recent Round Name:', recentRound.roundName);
      } else {
        console.log('No valid rounds found.');
      }
  
      if (previousRound) {
        console.log('Previous Round End Date:', previousRound.endDate);
        console.log('Previous Round Name:', previousRound.roundName);
      } else {
        console.log('No previous round found.');
      }
    } catch (error) {
      console.error('Error fetching rounds:', error);
    }
}

async function getTotalAmountBetweenDates(from: string | null, to: string): Promise<number> {
    try {
      const toDate = new Date(to);
      const purchasesRef = db.collection('purchases');
      let purchasesQuery;
  
      if (from) {
        const fromDate = new Date(from);
        purchasesQuery = purchasesRef
          .where('creation_at', '>=', fromDate)
          .where('creation_at', '<=', toDate);
      } else {
        purchasesQuery = purchasesRef
          .where('creation_at', '<=', toDate);
      }
  
      const purchasesSnapshot = await purchasesQuery.get();
  
      if (purchasesSnapshot.empty) {
        console.log('No purchases found within the given date range.');
        return 0;
      }
  
      const totalAmount = purchasesSnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data.totalAmount || 0);
      }, 0);
  
      console.log(`Total Amount between ${from ? from : 'beginning'} and ${to}:`, totalAmount);
      return totalAmount;
    } catch (error) {
      console.error('Error fetching purchases:', error);
      throw error;
    }
  }
  
  async function exportDocsFromEachCollection(percent: number) {
    if (percent <= 0 || percent > 100) {
      throw new Error('Percent must be a number between 0 and 100');
    }
  
    try {
      const collections = await db.listCollections();
      const exportData: ExportData = {};
  
      for (const collection of collections) {
        const collectionName = collection.id;
        const totalDocsSnapshot = await collection.get();
        const totalDocs = totalDocsSnapshot.size;
        const docCount = Math.ceil(totalDocs * (percent / 100));
  
        if (totalDocs > 0) {
          const documentsSnapshot = await collection.limit(docCount).get();
          exportData[collectionName] = documentsSnapshot.docs.map(doc => ({
            id: doc.id,
            data: doc.data()
          }));
        } else {
          exportData[collectionName] = null;
        }
      }
  
      console.log('Exported data:', JSON.stringify(exportData, null, 2));
    } catch (error) {
      console.error('Error exporting collections:', error);
    }
  }
  
  async function importDataFromFile(filePath: string) {
    try {
      const fileContent = filesys.readFileSync(filePath, 'utf8');
      const exportData: ExportData = JSON.parse(fileContent);
  
      for (const collectionName in exportData) {
        const documents = exportData[collectionName];
        if (documents) {
          for (const doc of documents) {
            await db.collection(collectionName).doc(doc.id).set(doc.data);
          }
        }
      }
  
      console.log('Data import completed successfully.');
    } catch (error) {
      console.error('Error importing data:', error);
    }
  }

  async function getPurchasesWithinDateRange(from:String, to:String) {
    try {
      // Converte le date in oggetti Timestamp di Firestore
      const fromTimestamp = Timestamp.fromDate(new Date(from+''));
      const toTimestamp = Timestamp.fromDate(new Date(to+''));
  
      // Esegue la query
      const snapshot = await db.collection('purchases')
        .where('creation_at', '>=', fromTimestamp)
        .where('creation_at', '<=', toTimestamp)
        .get();
  
      if (snapshot.empty) {
        console.log('No matching documents.');
        return;
      }
  
      // Estrae e stampa i dati dei documenti
      snapshot.forEach(doc => {
        console.log(doc.id, '=>', doc.data());
      });
    } catch (error) {
      console.error('Error getting documents: ', error);
    }
  }


(async function () {
    console.log('--- BEGIN runner ---');
    try {
        //await clearUserWallets();
        //await getUsersBoosters();
        //await addFreeBoostersToUsers();
        //await deleteFreeBoosters();
        //await getRecentAndPreviousRoundEndDates();

        //get total revenue between dates
        // const from = '2024-04-20T02:15:00';
        // const to = '2024-12-31T23:59:59';
        // getTotalAmountBetweenDates(from, to);

        //const exportPercent = 3; 
        //exportDocsFromEachCollection(exportPercent);

        // Specifica il percorso del file JSON qui
        // const jsonFilePath = '/Users/andreamaltese/Documents/lavori/INTRAVERSE/metatope/export-dev.json';
        // importDataFromFile(jsonFilePath);

        // const from = '2024-05-21T00:00:00Z'; // Data di inizio (ISO 8601)
        // const to = '2024-05-30T23:59:59Z';   // Data di fine (ISO 8601)
        // getPurchasesWithinDateRange(from, to);


        console.log('--- END runner ---');
    } catch (e) {
        console.log("Errore nell'esecuzione del runner: ", e);
        console.log(e);
    }
})();